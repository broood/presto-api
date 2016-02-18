'use strict';
var bsonify = require('bsonify');
var revalidator = require('revalidator');

module.exports = {
	middleware: function(req, res, next) {

		let path = req.path;
		if(path.length > 0) {
			if(path[path.length - 1] === '/') {
				path = path.substr(0, path.length - 1);
			}
		}

		let resource,
			resourceName,
			resourceToken = path.match(new RegExp('^' + this.config.base + '((?:[^\\/]*)|.*(?:$))'));
		if(resourceToken && resourceToken.length > 1) {
			resourceName = resourceToken[1];
			if(resourceName) {
				resource = this.resources[resourceName];
			}
		}

		if(resource) {

			req.presto = req.presto || {};
			res.presto = res.presto || {};
			req.presto.resource = resource;
			req.presto.params = {};

			// extend the response object
			res.presto.send = (items, start) => {
				if (req.method === 'GET') {
					if(items && !(items instanceof Array)) {
						items = [items];
					}
					items = {
						count: (items && items.length) || 0,
						items: items || [],
						cached: false,
						elapsed: (+new Date() - start)
					};
				}
				this.config.jsonp ? res.status(200).jsonp(items) : res.status(200).json(items);
			};
			res.presto.error = message => {
				var data = {
					error: message
				};
				this.config.jsonp ? res.jsonp(data) : res.json(data);
			};

			if (this.initialized !== true) {
				return res.presto.error('Database failed to initialize');
			}

			// extend the request object
			if (req.method === 'GET') {

				let params = {};

				// FIELDS
				let fields = {};
				if (req.query.fields && req.query.fields.length > 0) {
					req.query.fields.split(',').forEach(function(name) {
						fields[name] = 1;
					});

					if(fields._id === undefined) {
						fields._id = 0;
					}
				}
				params.fields = fields;

				// SKIP
				let skip = 0;
				if (req.query.offset) {
					let temp = parseInt(req.query.offset, 10);
					if (temp > 0) {
						skip = temp;
					}
				}
				params.skip = skip;

				// SORT
				// typical sort: ?sort=created:desc
				let sort = {};
				if (req.query.sort) {
					let sorts = req.query.sort.split(','),
						dir;

					if (sorts.length > 0) {
						let sortField,
							sortTokens,
							tempDir;

						for (let i = 0, l = sorts.length; i < l; i++) {
							sortField = sorts[i];
							sortTokens = sortField.split(':');

							dir = 1;
							if (sortTokens.length > 1) {
								tempDir = sortTokens[1];
								if (tempDir === 'desc') {
									dir = -1;
								}
							}
							sort[sortTokens[0]] = dir;
						}
					}
				} else if(resource.sort) {
					// ex: map _id: desc to _id: -1
					for(var field in resource.sort) {
						if(resource.sort.hasOwnProperty(field)) {
							let dir = -1;
							if(resource.sort[field] !== 'desc') {
								dir = 1;
							}
							sort[field] = dir;
						}
					}
				}
				params.sort = sort;

				// LIMIT
				let limit = resource.limit || 0;
				if (req.query.limit && !isNaN(req.query.limit)) {
					limit = parseInt(req.query.limit, 10);
				}
				params.limit = limit;

				params.id = req.params.id;
				req.presto.params = params;

				// QUERY
				let query = {},
					schema = resource.schema && resource.schema.properties || {},
					url = req.url,
					uri = url.match(new RegExp(resource.name + '/_/([^?]*)'));

				if (uri && uri.length > 1) {
					let tokens = uri[1].split('/'),
						field,
						value;

					for (let i = 0, l = tokens.length; i < l; i += 2) {
						if (i + 1 < tokens.length) {
							field = decodeURIComponent(tokens[i]);
							value = decodeURIComponent(tokens[i + 1]);

							if (field && value) {
								if (schema[field]) {
									if (schema[field].prestoType === 'id') {
										value = bsonify.convert(value);
									} else if (schema[field].type === 'integer') {
										value = parseInt(value, 10);
									} else if (schema[field].type === 'date-time') {
										value = new Date(value);
									}
								}

								if (typeof value === 'string') {
									query[field] = {
										$regex: new RegExp('^' + value + '$', 'i')
									};
								} else {
									query[field] = value;
								}
							}
						}
					}
				}

				// special 'full' text search query -- will search multiple fields. requires a text index to be set up on the collection
				if (req.query.q) {
					let search = '\"' + req.query.q + '\"'; // use mongodb phrase... @TODO may want to support multi-word searching
					query.$text = { $search: search };
				}

				req.presto.query = query;
			}

			let schema = resource.schema && resource.schema.properties;

			if(req.params.id !== undefined) {

				// default to id param as a string
				let query = {},
					id = req.params.id;

				if(schema && schema[resource.id]) {
					let field = schema[resource.id];
					if(field.prestoType === 'id') {
						id = bsonify.convert(id);
					} else if(field.type === 'integer') {
						id = parseInt(id, 10);
					}
				}

				query[resource.id] = id;

				req.presto.params.id = id;
				req.presto.query = query;
			}

			if(req.method === 'PUT' || req.method === 'POST') {
				let item = req.body,
					d = +new Date();
				if(schema) {
					let result = revalidator.validate(item, schema);
					if(result.valid === false) {
						return res.presto.error(result.errors && result.errors[0] || 'Data did not align with schema');
					}
				}

				item = bsonify.convert(item);
				item.created = item.created || d;
				item.modified = item.modified || d;

				req.presto.item = item;
			}

			// global support for CORS?
			if (this.config.crossDomain === true) {
				res.header('Access-Control-Allow-Origin', this.config.crossDomainAllowOrigin || '*');
				res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
				res.header('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, DELETE, HEAD');
			} else if(resource && resource.crossDomain === true) {
				res.header('Access-Control-Allow-Origin', resource.crossDomainAllowOrigin || '*');
				res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
				if(req.method === 'GET') {
					res.header('Access-Control-Allow-Methods', 'OPTIONS, GET, HEAD');
				} else if(req.method === 'POST') {
					res.header('Access-Control-Allow-Methods', 'OPTIONS, POST, HEAD');
				} else if(req.method === 'DELETE') {
					res.header('Access-Control-Allow-Methods', 'OPTIONS, DELETE, HEAD');
				} else if(req.method === 'PUT') {
					res.header('Access-Control-Allow-Methods', 'OPTIONS, PUT, HEAD');
				}
			}

			res.header('X-API-Powered-By', 'Presto-API');

			if(req.method === 'GET') {
				let maxAge = null;
				if(this.config.maxAge) {
					maxAge = this.config.maxAge;
				}
				if(resource && resource.maxAge) {
					maxAge = resource.maxAge;
				}

				console.log("@@@ set cache control to: " + maxAge);

				if(maxAge) {
					res.header('Cache-Control', 'max-age=' + maxAge);
				}
			}
		}

		next();
	}
};