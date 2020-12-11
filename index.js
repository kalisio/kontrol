#!/usr/bin/env node
const path = require('path')
const cors = require('cors')
const express = require('express')
const cron = require('cron')
const request = require('got')
const _ = require('lodash')
const Docker = require('dockerode')

const port = process.env.PORT || 8080
const config = require(process.env.CONFIG_FILEPATH || path.join(__dirname, 'config.js'))

let server
let jobs = {}
const docker = new Docker(config.docker)

async function publishToSlack (task, body) {
  if (!process.env.SLACK_WEBHOOK_URL) return
  try {
    await request({
      url: process.env.SLACK_WEBHOOK_URL,
      method: 'POST',
      body: JSON.stringify(body)
    })
  } catch (error) {
    // Allowed to fail to make healthcheck robust
    console.error(`Notification for task ${task} failed`, error)
  }
}

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

    // Report random errors when under test
    if (process.env.UNDER_TEST) return res.status(Math.random() > 0.5 ? 200 : 500).json(response)
    else return res.status(200).json(response)
  })
  // Start the server
  server = app.listen(port, () => {
    console.log('kontrol server listening at %d', port)
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
        job.health = {
          statusCode: response.statusCode,
          statusMessage: response.statusMessage
        }
      } catch (error) {
        console.error(`Scheduled task ${key} error`, error)
        job.health = {
          error
        }
        console.log(`Notifying for task ${key}`)
        try {
          const body = await jobOptions.notify(error)
          await publishToSlack (key, body)
        } catch (error) {
          console.error(`Notification for task ${key} failed`, error)
        }
        console.log(`Performing healing for task ${key}`)
        try {
          await jobOptions.heal(docker, _)
        } catch (error) {
          console.error(`Healing for task ${key} failed`, error)
        }
      }
      job.isRunning = false
    })
    jobs[key] = { cronJob, health: {} }
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
