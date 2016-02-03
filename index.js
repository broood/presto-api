/* jslint node: true */
'use strict';

let express = require('express');
let bodyParser = require('body-parser');
let mongo = require('mongodb');
let bsonify = require('bsonify');
let extend = require('extend');
let Server = mongo.Server;
let Db = mongo.Db;
let utils = require('./utils');
let defaults = require('./defaults');

class Presto {

	constructor(config) {

		this.config = extend({}, defaults, config);

		if (this.config.version) {
			this.config.base = '/' + this.config.version + '/';
		}

		this.resources = {};
		this.config.resources.forEach(resource => {
			if(resource && resource.name) {
				this.resources[resource.name] = resource;
			}
		});

		this.app = new express();

		this.app.use(bodyParser.json());
		this.app.use(utils.middleware.bind(this));

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
		let resources = this.config.resources;

		if (resources && resources.length > 0) {
			resources.forEach(resource => {
				let name = resource.name;
				if (name) {
					if (resource.get === true || resource.get === undefined) {
						this.app.get(this.config.base + name + '/:id', this._findItemById(resource));
						this.app.get(this.config.base + name + '/*', this._findItems(resource));
					}
					if (resource.post === true) {
						// @TODO - define a schema?
						this.app.post(this.config.base + name, this._addItem(resource));
					}
					if (resource.put === true) {
						// @TODO ensure updated item matches schema
						this.app.put(this.config.base + name + '/:id', this._updateItem(resource));
					}
					if (resource.del === true) {
						this.app.delete(this.config.base + name + '/:id', this._deleteItem(resource));
					}
				}
			});
		}
	}

	_defineIndex() {
		let resources = this.config.resources;
		this.app.get(this.config.base, (req, res) => {
			res.writeHead(200, {
				'Content-Type': 'text/html'
			});
			let html = '<h2>' + this.config.name + '</h2>';
			if (resources && resources.length > 0) {
				html += '<ul>';
				resources.forEach(resource => {
					html += '<li><a href="' + this.config.base + resource.name + '/">' + resource.name + '</a></li>';
				});
				html += '</ul>';
			}
			res.write(html);
			res.end();
		});
	}

	_findItems(resource) {
		return (req, res) => {
			// @TODO use object destructuring
			let resourceName = resource.name,
				query = req.presto.params.query,
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
			console.log("@@@ find items by id: " + req.params.id);
			let resourceName = resource.name,
				fields = req.presto.params.fields || {},
				// id = req.presto.params.id,
				id = req.params.id,
				start = +new Date();

			if (this.initialized !== true) {
				return res.presto.error('Database failed to initialize');
			}

			this.db.collection(resourceName, (err, collection) => {
				if (err) {
					return res.presto.error(err);
				}

				collection.findOne({
					_id: bsonify.convert(id)
				}, fields, (err, item) => {
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
				item = req.body,
				d = new Date();

			if (this.initialized !== true) {
				return res.presto.error('Database failed to initialize');
			}

			item = bsonify.convert(item);
			item.created = item.created || d;
			item.modified = item.modified || d;

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
				id = resource.id || req.params.id;

			if (this.initialized !== true) {
				return res.presto.error('Database failed to initialize');
			}

			this.db.collection(resourceName, (err, collection) => {
				if (err) {
					return res.presto.error(err);
				}
				collection.remove({
					_id: bsonify.convert(id)
				}, {
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
				id = req.params.id,
				item = resource.item || req.body,
				d = new Date();

			if (this.initialized !== true) {
				return res.presto.error('Database failed to initialize');
			}

			item = bsonify.convert(item);
			item.modified = d;

			this.db.collection(resourceName, (err, collection) => {
				if (err) {
					return res.presto.error(err);
				}

				collection.update({
					_id: bsonify.convert(id)
				}, item, {
					safe: true
				}, (err, result) => {
					if (err) {
						return res.presto.error(err);
					}

					item._id = id;
					res.presto.send(result);
				});
			});
		};
	}
}

module.exports = Presto;