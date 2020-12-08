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
			commands: [
				{ command: 'listContainers', filter: { Names: { $elemMatch: { $regex: '.*kontrol.*' } } }, result: 'container' },
				{ command: 'getContainer', options: '<%= container.Id %>', result: 'container' },
				{ command: 'stop', target: 'container' },
				{ command: 'remove', target: 'container' }
				//{ command: 'listServices', filter: { Names: { $elemMatch: { $regex: '.*kontrol.*' } } }, result: 'service' },
				//{ command: 'getService', options: '<%= service.Id %>', result: 'service' },
				//{ command: 'remove', target: 'service' }
			]
		}
	}
}