#presto-api

Easily build a RESTful API on top of MongoDB collections.

In order to start building a project, it's often wise to set up a RESTful API.  Presto-API allows you to build an API-by-configuration, rather than API-by-middleware.

###Usage

###Minimal Configuration

At the minimum Presto-API requires an array of resources so that it can map API routes to your MongoDB collections.  Typically this is an array of configuration options that describe how an API endpoint should handle a particular resource.  However, you can also pass a string array of resource names.  In this case, Presto-API will use sensible defaults to complete the setup.  See defaults section for more.

###Minimal Usage
```js
let Presto = require('presto-api');
let api = new Presto({
	resources: ['widgets']
});
api.init();
```

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

###Configuration Options

#####name (optional)
Type: String

#####version (optional)
Type: String

#####port (optional)
Type: Integer

Port on which your API will listen for requests.

Default: 3000

#####jsonp (optional)
Type: Boolean

When true, your resource routes will support JSONP formatted responses.

Default: true

#####crossDomain (optional)
Type: Boolean

When true, your resource routes will have CORS (cross-origin resource sharing) support.

Default: true

#####crossDomainAllowOrigin (optional)
Type: String

Specify allowable CORS origins.

Default: * (all origins)

#####maxAge (optional)
Type: Integer

When specified, a Cache-Control header will be added to your GET routes.

#####database.host (optional)
Type: String

Machine on which mongod is running

Default: localhost

#####database.port (optional)
Type: Integer

Port on which mongod is listening.

Default: 27017

#####database.name (optional)
Type: String

Name of your MongoDB database
	
Default: local

#####resources (**required**)
Type: Array

Resources in the configuration object correspond to your MongoDB collections.  Presto-API routes will be added For each 		resource specified here.

#####resource.name (**required**)
Type: String

Name of your resource (MongoDB collection).

#####resource.sort (optional)
Type: Object

When specified, a default sort will be added to GET requests to the specified resource.  This will be overridden if a sort 		query parameter is specified in the GET request.

#####resource.limit (optional)
Type: Integer
	
Provides a default limit to GET requests to your resource.  This can be overridden by specifying a limit query parameter.

#####resource.get (optional)
Type: Boolean

When true, a route will be setup that allows GET operations on your collection.

curl http://localhost:3000/songs/
curl http://localhost:3000/songs/566073c92f1cc55a23b64f3b
	
Default: true

#####resoure.post (optional)
Type: Boolean
	
When true, a route will be setup that allows POST operations on your collection.
	
Default: true

#####resource.put (optional)
Type: Boolean
	
When true, a route will be setup that allows PUT operations on your collection.
	
Default: true

#####resource.del (optional)
Type: Boolean
	
When true, a route will be setup that allows DELETE operations on your collection.
	
Default: true

#####resource.schema (optional)
Type: Object
	
When provided, Presto-API will ensure that data POSTed or PUT to your API endpoint will conform to the specified schema.

Presto-API accepts arbitrarily deep JSON objects here and allows for the following field types: string, number, id (MongoDB 		ObjectID), and date.

###Querying your Presto-API

#####fields	
Type: String
	
Limit your result set by providing a comma-delimited string of fields to be included.
	
Ex: Only include artist, album, name and year in the result set
`/songs/?fields=artist,album,name,year`

#####sort
Type: String
	
Specify the order in which mongodb documents are returned in your result set by providing a field and a sort direction 			separated by a colon (`?sort=<field>:<direction>`).  Sort direction is either asc (ascending) or desc (descending).  If not 	specified, sort defaults to asc.
	
Ex: Sort songs by artist
`/songs/?sort=artist:asc`
	
In order to specify multiple sorts, provide a comma-delimited string of fields and sort directions.
	
Ex: Specify primary, secondary and tertiary sorts
`/songs/?sort=artist:asc,album:asc,name:asc`

######offset
Type: Integer

Corresponds to MongoDB's skip functionality -- allows you to specify where MongoDB begins returnings results.

Ex: Return the 101st-111th most recently created song objects.
`/songs/?offset=100&sort=created:desc&limit=10`

#####limit
Type: Integer

Limit the number of documents returned in the result set.

Ex: Return no more than 10 songs
`/songs/?limit=10`

#####q
Type: String

Full-text search query -- this allows searching of multiple fields.  Note that this requires a text index to be set up on the collection.

Ex: Return all songs in which the artist, album or song name include the word moon.  (In this case a text index has been created for the songs collection including artist, album and song fields).
`/songs/?q=moon`

###Field-specified Querying
In order to facilitate searching of individual fields of your collections, Presto-API accepts key-value pairs that have been separated from the URI with an underscore.
`/songs/_/<property_name>/<property_value>`

Ex: Return all songs by Beirut
`/songs/_/artist/beirut`

Ex: Return all songs by Beirut from the year 2006
`/songs/_/artist/beirut/year/2006`








