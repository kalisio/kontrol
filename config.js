module.exports = {
	docker: {},
	jobs: {
		kontrol: {
			cron: '*/3 * * * * *',
			url: 'http://localhost:8080/healthcheck',
			method: 'GET',
			headers: {},
			searchParams: {},
			retry: 1,
			timeout: 10000,
			notify: (error) => {
				return {
				   attachments: [{
            color: 'danger',
            mrkdwn_in: ['text'],
            text: `*kontrol healthcheck failed*\n${error}\nNow healing by restarting`
          }]
				}
			},
			heal: async (docker, _) => {
				const containers = await docker.listContainers()
				let container = _.find(containers, (container => container.Image === 'kalisio/kontrol'))
				container = await docker.getContainer(container.Id)
				await container.restart()
			}
		}
	}
}
