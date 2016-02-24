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

		this.resources = utils.configureResources(this.config);

		this.app = new express();

		this.app.use(bodyParser.json());
		this.app.use(compress());

		this._defineIndex();
		this._defineRoutes();
	}

	init(options) {

		if(!options) { options = {} };

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

				if(options.listen !== false) {
					this.app.listen(this.config.port);
					console.log(this.config.name + ' up and running on port ' + this.config.port);
				}
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

		this.app.get(this.config.base + "resources", function(req, res) {
			res.json(this.resources);
		}.bind(this));
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
			this.findItems(req.presto.params, function(err, items) {
				if(err) {
					return res.presto.error(err);
				}
				res.presto.send(items, req.presto.params);
			});
		};
	}

	_findItemById(resource) {
		return (req, res) => {
			this.findItemById(req.presto.params, function(err, items) {
				if(err) {
					return res.presto.error(err);
				}
				res.presto.send(items, req.presto.params);
			});
		};
	}

	_addItem(resource) {
		return (req, res) => {
			this.addItem(req.presto.params, function(err, items) {
				if(err) {
					return res.presto.error(err);
				}
				res.presto.send(items, req.presto.params);
			});
		};
	}

	_updateItem(resource) {
		return (req, res) => {
			this.updateItem(req.presto.params, function(err, result) {
				if(err) {
					return res.presto.error(err);
				}
				res.presto.send(result, req.presto.params);
			});
		};
	}

	_deleteItem(resource) {
		return (req, res) => {
			this.deleteItem(req.params.presto, function(err, result) {
				if(err) {
					return res.presto.error(err);
				}
				res.presto.send(result, req.presto.params);
			});
		};
	}

	findItems(obj, callback) {
		let collectionName = obj.collectionName,
			query = obj.query || {},
			fields = obj.fields || {},
			sort = obj.sort || {},
			limit = obj.limit || 0,
			skip = obj.skip || 0;

		this.db.collection(collectionName, (err, collection) => {
			if (err) {
				return callback(err);
			}
			collection.find(query, fields).sort(sort).limit(limit).skip(skip).toArray(callback);
		});
	}

	findItemById(obj, callback) {
		let collectionName = obj.collectionName,
			query = obj.query || {},
			fields = obj.fields || {};

		this.db.collection(collectionName, (err, collection) => {
			if (err) {
				return callback(err);
			}

			collection.findOne(query, fields, callback);
		});
	}

	addItem(obj, callback) {
		let collectionName = obj.collectionName,
			item = obj.item;

		this.db.collection(collectionName, (err, collection) => {
			if (err) {
				return callback(err);
			}

			collection.insert(item, {
				safe: true
			}, callback);
		});
	}

	updateItem(obj, callback) {
		let collectionName = obj.collectionName,
			query = obj.query,
			item = obj.item;

		this.db.collection(collectioName, (err, collection) => {
			if (err) {
				return callback(err);
			}

			collection.update(query, item, {
				safe: true
			}, callback);
		});
	}

	deleteItem(obj, callback) {
		let collectionName = obj.collectionName,
			query = obj.query;

		this.db.collection(collectionName, (err, collection) => {
			if (err) {
				return callback(err);
			}
			collection.remove(query, {
				safe: true
			}, callback);
		});
	}
}

module.exports = Presto;