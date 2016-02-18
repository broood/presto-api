/* jslint node: true */
'use strict';

let express = require('express');
let bodyParser = require('body-parser');
let compress = require('compression');
let mongo = require('mongodb');
let extend = require('extend');
let Server = mongo.Server;
let Db = mongo.Db;
let utils = require('./utils');
let defaults = require('./defaults');
let resourceDefaults = require('./resourceDefaults');

class Presto {

	constructor(config) {

		this.config = extend(true, {}, defaults, config);

		if (this.config.version) {
			this.config.base = '/' + this.config.version + '/';
		}

		this.resources = {};
		this.config.resources.forEach(resource => {
			if(resource) {
				if(typeof resource === 'string') {
					this.resources[resource] = extend(true, {}, resourceDefaults, {name: resource});
				} else if(typeof resource === 'object' && resource.name) {
					this.resources[resource.name] = extend(true, {}, resourceDefaults, resource);
				}

				if(resource.schema) {
					// @TODO this needs to be recursive and support arbitrarily deep structures
					let schema = {properties: {}};
					for(let field in resource.schema) {
						if(resource.schema.hasOwnProperty(field)) {
							let type = resource.schema[field];

							if(type === 'id') {
								schema.properties[field] = {
									type: 'string',
									conform: function(val) {
										return val.test(/^[0-9a-fA-F]{24}$/);
									},
									messages: {
										type: 'Expected a MongoDB id',
										format: 'Expected a MongoDB id'
									},
									prestoType: 'id'
								};
							} else if(type === 'date') {
								schema.properties[field] = {
									type: 'string',
									format: 'date'
								};
							} else if(type === 'date-time') {
								schema.properties[field] = {
									type: 'string',
									format: 'date-time'
								};
							} else {
								schema.properties[field] = {
									type: type
								}
							}
						}
					}

					this.resources[resource.name].schema = schema;
				}
			}
		});

		this.app = new express();

		this.app.use(bodyParser.json());
		this.app.use(compress());

		this._defineIndex();
		this._defineRoutes();
	}

	init() {
		this.server = new Server(this.config.database.host, this.config.database.port, {
			auto_reconnect: true
		});

		this.db = new Db(this.config.database.name, this.server, {
			safe: true
		});

		this.db.open((err, db) => {
			if (err) {
				console.log('ERROR: Database failed to open');
			} else {
				this.initialized = true;
				this.app.listen(this.config.port);
				console.log(this.config.name + ' up and running on port ' + this.config.port);
			}
		});
	}

	_defineRoutes() {

		let middleware = utils.middleware.bind(this);

		for(let key in this.resources) {
			if(this.resources.hasOwnProperty(key)) {
				let resource = this.resources[key],
					name = resource.name;
				if (name) {
					if (resource.get === true) {
						this.app.get(this.config.base + name + '/:id', middleware, this._findItemById(resource));
						this.app.get(this.config.base + name + '*', middleware, this._findItems(resource));
					}
					if (resource.post === true) {
						this.app.post(this.config.base + name, middleware, this._addItem(resource));
					}
					if (resource.put === true) {
						this.app.put(this.config.base + name + '/:id', middleware, this._updateItem(resource));
					}
					if (resource.del === true) {
						this.app.delete(this.config.base + name + '/:id', middleware, this._deleteItem(resource));
					}
				}
			}
		}
	}

	_defineIndex() {
		this.app.get(this.config.base, (req, res) => {
			res.writeHead(200, {
				'Content-Type': 'text/html'
			});
			let html = '<h2>' + this.config.name + '</h2>';
			html += '<ul>';
			for(let key in this.resources) {
				if(this.resources.hasOwnProperty(key)) {
					let resource = this.resources[key];
					html += '<li><a href="' + this.config.base + resource.name + '/">' + resource.name + '</a></li>';
				}
			}
			html += '</ul>';
			res.write(html);
			res.end();
		});
	}

	_findItems(resource) {
		return (req, res) => {
			// @TODO use object destructuring
			let resourceName = resource.name,
				query = req.presto.query,
				fields = req.presto.params.fields,
				sort = req.presto.params.sort,
				limit = req.presto.params.limit,
				skip = req.presto.params.skip,
				start = +new Date();

			this.db.collection(resourceName, (err, collection) => {
				if (err) {
					return res.presto.error(err);
				}
				collection.find(query, fields).sort(sort).limit(limit).skip(skip).toArray((err, items) => {
					if (err) {
						return res.presto.error(err);
					}
					res.presto.send(items, start);
				});
			});
		};
	}

	_findItemById(resource) {
		return (req, res) => {
			let resourceName = resource.name,
				query = req.presto.query,
				fields = req.presto.params.fields || {},
				start = +new Date();

			this.db.collection(resourceName, (err, collection) => {
				if (err) {
					return res.presto.error(err);
				}

				collection.findOne(query, fields, (err, item) => {
					if (err) {
						return res.presto.error(err);
					}
					res.presto.send(item, start);
				});
			});
		};
	}

	_addItem(resource) {
		return (req, res) => {
			let resourceName = resource.name,
				item = req.presto.item;

			this.db.collection(resourceName, (err, collection) => {
				if (err) {
					return res.presto.error(err);
				}

				collection.insert(item, {
					safe: true
				}, (err, results) => {
					if (err) {
						return res.presto.error(err);
					}
					res.presto.send(results);
				});
			});
		};
	}

	_deleteItem(resource) {
		return (req, res) => {
			let resourceName = resource.name,
				query = req.presto.query;

			this.db.collection(resourceName, (err, collection) => {
				if (err) {
					return res.presto.error(err);
				}
				collection.remove(query, {
					safe: true
				}, (err, result) => {
					if (err) {
						return res.presto.error(err);
					}
					res.presto.send({
						success: true,
						result: result
					});
				});
			});
		};
	}

	_updateItem(resource) {
		return (req, res) => {
			let resourceName = resource.name,
				query = req.presto.query,
				item = req.presto.item;

			this.db.collection(resourceName, (err, collection) => {
				if (err) {
					return res.presto.error(err);
				}

				collection.update(query, item, {
					safe: true
				}, (err, result) => {
					if (err) {
						return res.presto.error(err);
					}

					res.presto.send(result);
				});
			});
		};
	}
}

module.exports = Presto;