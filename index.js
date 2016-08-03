/* jslint node: true */
'use strict';

let express = require('express');
let bodyParser = require('body-parser');
let compress = require('compression');
let ejs = require('ejs');
let mongo = require('mongodb');
let extend = require('extend');
let path = require('path');
let utils = require('./utils');
let configDefaults = require('./defaults/config');
let Server = mongo.Server;
let Db = mongo.Db;

class Presto {

	constructor(config) {

		this.config = extend(true, {}, configDefaults, config);

		if (this.config.version) {
			this.config.base = '/' + this.config.version + '/';
		}

		this.resources = utils.configureResources(this.config);

		this.app = new express();

		this.app.use(bodyParser.json());
		this.app.use(compress());

		this.app.set('views', __dirname + '/views');
		this.app.set('view engine', 'ejs');
		this.app.use(express.static(__dirname + '/public'));

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

				if(options.callback && typeof options.callback === 'function') {
					options.callback();
				}
			}
		});
	}

	_defineRoutes() {

		let middleware = utils.middleware.bind(this);

		for(let name in this.resources) {
			if(this.resources.hasOwnProperty(name)) {
				let resource = this.resources[name];
				if (name) {
					if (resource.get === true) {
						this.app.get(this.config.base + name + '/:id', middleware, this._findItemById(resource));
						this.app.get(this.config.base + name + '/', middleware, this._findItems(resource));
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
		
		if(this.config.index === true) {
			this.app.get(this.config.base, (req, res) => {
				res.render('index.ejs', {
					config: this.config,
					resources: this.resources,
					host: req.headers.host,
					protocol: req.connection.encrypted === true ? 'https' : 'http'
				});
			});
		}

		this.app.get('*', function(req, res) {
			res.status(404).json({error: 'Unsupported URI'});
		});
	}

	_findItems(resource) {
		return (req, res) => {
			this.findItems(req.presto.params, function(err, items) {
				if(err) {
					return res.presto.error(400, err);
				}
				res.presto.send(items, req.presto.params);
			});
		};
	}

	_findItemById(resource) {
		return (req, res) => {
			this.findItemById(req.presto.params, function(err, items) {
				if(err) {
					return res.presto.error(400, err);
				}
				res.presto.send(items, req.presto.params);
			});
		};
	}

	_addItem(resource) {
		return (req, res) => {
			this.addItem(req.presto.params, function(err, result) {
				if(err) {
					return res.presto.error(400, err);
				}
				res.presto.send(result, req.presto.params);
			});
		};
	}

	_updateItem(resource) {
		return (req, res) => {
			this.updateItem(req.presto.params, function(err, result) {
				if(err) {
					return res.presto.error(400, err);
				}
				res.presto.send(result, req.presto.params);
			});
		};
	}

	_deleteItem(resource) {
		return (req, res) => {
			this.deleteItem(req.presto.params, function(err, result) {
				if(err) {
					return res.presto.error(400, err);
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

		// revalidate at this point?

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

		this.db.collection(collectionName, (err, collection) => {
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