module.exports = {
  docker: {},
  jobs: {
    kontrol: {
      cron: '*/30 * * * * *',
      url: 'http://localhost:8080/healthcheck',
      method: 'GET',
      headers: {},
      searchParams: {},
      retry: 1,
      timeout: 10000,
      notify: (error) => ({
         attachments: [{
          color: (error ? 'danger' : 'good'),
          mrkdwn_in: ['text'],
          text: (error ? `*kontrol healthcheck failed*\n${error}\nNow healing by restarting`
                       : `*kontrol healthcheck succeeded*`)
        }]
      }),
      heal: async (docker, _) => {
        const containers = await docker.listContainers()
        let container = _.find(containers, (container => container.Image === 'kalisio/kontrol'))
        container = await docker.getContainer(container.Id)
        await container.restart()
      }
    }
  }
}
