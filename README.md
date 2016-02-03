presto-api
==========

Instantly setup a REST API for any collection of mongo documents.

Getting Started
---------------

```js
var RestAPI = require('presto-api');
var api = new RestAPI({
	api: {
		name: 'api.widgets.com',
		version: 'v0',
		port: 3000
	},
	database: {
		host: 'localhost',
		port: '27017',
		name: 'widgetsdb'
	},
	resources: [
		{
			name: 'widgets',
			sort: { widget_id: 1 },
			limit: 20,
			get: true,
			post: true,
			put: true,
			del: true,
			schema: {
				widget_id: 'number',
				name: 'string',
				price: 'string',
				img_path: 'string',
				for_sale: 'boolean'
			}
		}
	]
});

api.init();
```

Configuration Options
=====================

```js
{
	api: {
		name: 'api.widgets.com',
		version: 'v0',
		port: 3000
	},
	database: {
		host: 'localhost',
		port: '27017',
		name: 'widgetsdb'
	},
	resources: [
		{
			name: 'widgets',
			sort: { widget_id: 1 },
			limit: 20,
			get: true,
			post: true,
			put: true,
			del: true,
			schema: {
				widget_id: 'number',
				name: 'string',
				price: 'string',
				img_path: 'string',
				for_sale: 'boolean'
			}
		}
	]
}
```




