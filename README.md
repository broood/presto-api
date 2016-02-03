presto-api
==========

Easily build a RESTful API on top of MongoDB collections.

In order to start building something, it's often necessary to set up a RESTful API.  Presto-API allows you to build an API-by-configuration, rather than API-by-middleware.

Typical Usage
---------------

The below snippet shows how one can quickly get an API set up.  With the below, you now have an API running that can handle typical RESTful operations (GET, POST, PUT and DELETE).

```js
let Presto = require('presto-api');
let api = new Presto({
	name: 'api.widgets.com',
	version: 'v0',
	port: 3000,
	jsonp: true,
	crossDomain: true,
	crossDomainAllowOrigin: '*',
	maxAge: 500,
	database: {
		host: 'localhost',
		port: 27017,
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

Minimal Configuration
=====================

At the absolute minimum Presto-API requires an array of resources.  Typically this is an array of configuration options that describe how an API endpoint should handle a particular resource.  However, you can also pass a string array of resource names.  In this case, Presto-API will use sensible defaults to complete the setup.  See defaults section for more.

Minimal Usage
-------------

```js
let Presto = require('presto-api');
let api = new Presto({
	resources: ['widgets']
});
```





