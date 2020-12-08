#!/usr/bin/env node
const path = require('path')
const cors = require('cors')
const express = require('express')
const cron = require('cron')
const request = require('got')
const _ = require('lodash')
const sift = require('sift')
const Docker = require('dockerode')

const port = process.env.PORT || 8080
const config = require(process.env.CONFIG_FILEPATH || path.join(__dirname, 'config.js'))

let server
let jobs = {}
const docker = new Docker(config.docker)

// Setup and launch server
function serve() {
  const app = express()
  app.use(cors()) // add CORS headers -- required

  // Healthcheck
  app.get('/healthcheck', (req, res) => {
    res.set('Content-Type', 'application/json')
    let response = {
      isRunning: true
    }
    // Expose all health states
    _.forOwn(jobs, (value, key) => {
      response[key] = value.health
    })

    return res.status(Math.random() > 0.5 ? 200 : 500).json(response)
  })
  // Start the server
  server = app.listen(port, () => {
    console.log('kontrol server listening at %d', port)
  })
}

function templateValue (value, context) {
  if (typeof value === 'string') {
    const compiler = _.template(value)
    return compiler(context)
  } else {
    return value
  }
}

function templateObject (object, context) {
  return _.mapValues(object, value => {
    if (typeof value === 'object') {
      return templateObject(value, context)
    } else {
      return templateValue(value, context)
    }
  })
}

// Plan all jobs
function plan() {
  for (const [key, jobOptions] of Object.entries(config.jobs)) {
    console.log(`Registering task ${key}`)
    const cronJob = new cron.CronJob(jobOptions.cron, async () => {
      let job = jobs[key]
      if (job.isRunning) {
        console.log(`Skipping scheduled task ${key} as previous one is not yet finished`)
        return
      }
      job.isRunning = true
      console.log(`Executing scheduled task ${key}`)
      try {
        const response = await request(jobOptions)
        console.log(`Scheduled task ${key} response:`, response.statusCode, response.statusMessage)
      } catch (error) {
        console.error(`Scheduled task ${key} error`, error)
        console.log(`Executing commands for task ${key}`)
        for (let i = 0; i < jobOptions.commands.length; i++) {
          const { command, target, options, filter, result } = jobOptions.commands[i]
          const object = _.get(job, `targets.${target}`, docker)
          const templatedOptions = (typeof options === 'object' ? templateObject(options, job.targets) : templateValue(options, job.targets))
          console.log(`Executing command ${command} for task ${key} on ${target} with options`, templatedOptions)
          let data = await object[command](templatedOptions)
          // When result is a list we can filter it to target a single object
          if (filter) {
            data = data.filter(sift(filter))
            if (data.length === 1) data = data[0]
          }
          console.log(`Result of command ${command} for task ${key} on ${target}`, data)
          // getXXX commands are used to retrive target objects like containers, services, etc.
          // and then call some methods on this objects
          if (result) {
            console.log(`Storing result of command ${command} for task ${key} in ${result} object`)
            _.set(job, `targets.${result}`, data)
          }
          if (command === 'remove') {
            console.log(`Removing ${result} object for task ${key}`)
            _.unset(job, `targets.${target}`)
          }
        }
      }
      job.isRunning = false
    })
    jobs[key] = { cronJob, health: {}, targets: { docker } }
    cronJob.start()
  }
}

process.on('SIGTERM', () => {
  console.info('SIGTERM signal received, closing now.')
  _.forOwn(jobs, value => {
    value.cronJob.stop()
  })
  server.close(() => {})
})

async function run () {
  plan()
  serve()
}

run()
