// index.js
var Presto = require('../index');
var should = require('chai').should();
var expect = require('chai').expect;
var supertest = require('supertest');
var api = supertest('http://localhost:3001');

var config = {
	port: 3001,
	database: {
		name: 'presto-test-db'
	},
	resources: [
		{
			name: 'widgets',
			id: 'id',
			schema: {
				properties: {
					_id: {
						type: 'id'
					},
					id: {
						type: 'integer',
						required: true
					},
					name: {
						type: 'string',
						required: true
					},
					description: {
						type: 'string',
						required: true
					},
					price: {
						type: 'number',
						required: true
					}
				}
			}
		}
	]
};

var widgets = [{
	id: 1,
	name: 'Widget #1',
	description: 'The first widget',
	price: 0.99
}, {
	id: 2,
	name: 'Widget #2',
	description: 'The second widget',
	price: 1.99
}, {
	id: 3,
	name: 'Widget #3',
	description: 'The third widget',
	price: 2.99
}];

function initialize(callback) {
	var presto = new Presto(config);
	presto.init({
		callback: function() {
			presto.deleteItem({
				collectionName: 'widgets',
				query: {}
			}, function() {
				presto.addItem({
					collectionName: 'widgets',
					item: widgets
				}, function() {

					presto.db.collection('widgets', (err, collection) => {
						if (!err) {
							collection.createIndex(
								{ '$**': 'text' },
								{ name: 'TextIndex'}
							);

							callback();
						}
					});
				});
			});
		}
	});
}

describe('Presto-API', function() {

	// set up our test db and data
	before(function(done) {
		initialize(function() {
			done();
		});
	});

	it('should return a collection of widgets', function(done) {
		api.get('/widgets')
			.set('Accept', 'application/json')
			.expect(200)
			.end(function(err, res) {
				expect(res.body).to.have.property('items');
				expect(res.body.items).to.have.length(3);
				done();
			});
	});

	it('should return one widget', function(done) {
		api.get('/widgets/1')
		.set('Accept', 'application/json')
		.expect(200)
		.end(function(err, res) {
			expect(res.body).to.have.property('items');
			expect(res.body.items).to.have.length(1);
			expect(res.body.items[0]).to.have.property('id');
			expect(res.body.items[0].id).to.equal(1);
			expect(res.body.items[0]).to.have.property('name');
			expect(res.body.items[0].name).to.equal('Widget #1');
			done();
		});
	});

	// test sorting
	it('should return widgets in order of id:asc', function(done) {
		api.get('/widgets/?sort=id:asc')
		.set('Accept', 'application/json')
		.expect(200)
		.end(function(err, res) {
			expect(res.body).to.have.property('items');
			expect(res.body.items).to.have.length(3);

			var lastId = -Infinity;
			res.body.items.forEach(function(item) {
				expect(item.id).to.be.above(lastId);
				lastId = item.id;
			});

			done();
		});
	});

	it('should return widgets in order of id:desc', function(done) {
		api.get('/widgets/?sort=id:desc')
		.set('Accept', 'application/json')
		.expect(200)
		.end(function(err, res) {
			expect(res.body).to.have.property('items');
			expect(res.body.items).to.have.length(3);

			var lastId = Infinity;
			res.body.items.forEach(function(item) {
				expect(item.id).to.be.below(lastId);
				lastId = item.id;
			});

			done();
		});
	});

	// test fields
	it('should only include specified fields in the result set', function(done) {
		api.get('/widgets/1?fields=id,name')
		.set('Accept', 'application/json')
		.expect(200)
		.end(function(err, res) {
			expect(res.body).to.have.property('items');
			expect(res.body.items).to.have.length(1);
			expect(res.body.items[0]).to.have.property('id');
			expect(res.body.items[0]).to.have.property('name');
			expect(res.body.items[0]).to.not.have.property('_id');
			expect(res.body.items[0]).to.not.have.property('description');
			expect(res.body.items[0]).to.not.have.property('price');
			done();
		});
	});

	// test limit
	it('should limit the result set', function(done) {
		api.get('/widgets/?limit=2')
		.set('Accept', 'application/json')
		.expect(200)
		.end(function(err, res) {
			expect(res.body).to.have.property('items');
			expect(res.body.items).to.have.length(2);
			done();
		});
	});

	// test offset
	it('should skip items based on offset', function(done) {
		api.get('/widgets/?offset=1')
		.set('Accept', 'application/json')
		.expect(200)
		.end(function(err, res) {
			expect(res.body).to.have.property('items');
			expect(res.body.items).to.have.length(2);
			expect(res.body.items[0]).to.have.property('id');
			expect(res.body.items[0].id).to.equal(2);
			done();
		});
	});

	// test query
	it('should only return items matching the query parameter', function(done) {
		api.get('/widgets/?q=first')
		.set('Accept', 'application/json')
		.expect(200)
		.end(function(err, res) {
			expect(res.body).to.have.property('items');
			expect(res.body.items).to.have.length(1);
			expect(res.body.items[0]).to.have.property('description');
			expect(res.body.items[0].description).to.equal('The first widget');
			done();
		});
	});

	// test field specific querying
	it('should only return items matching field-specific querying', function(done) {
		api.get('/widgets/_/description/The third widget')
		.set('Accept', 'application/json')
		.expect(200)
		.end(function(err, res) {
			expect(res.body).to.have.property('items');
			expect(res.body.items).to.have.length(1);
			expect(res.body.items[0]).to.have.property('name');
			expect(res.body.items[0].description).to.equal('The third widget');
			done();
		});
	});

	// POST
	it('should add one widget', function(done) {
		api.post('/widgets')
		.set('Accept', 'application/json')
		.send({
			id: 4,
			name: 'Widget #4',
			description: 'The fourth widget',
			price: 1.99
		})
		.expect(201)
		.end(function(err, res) {
			// check response body and response location header
			done();
		});
	});

	it('should reject POST requests that don\'t conform to the specified schema', function(done) {
		api.post('/widgets')
		.set('Accept', 'application/json')
		.send({
			id: '54a34',
			name: 'Widget #2',
			description: 'The second widget',
			price: 1.99
		})
		.expect(400)
		.end(function(err, res) {
			done();
		});
	});

	// PUT
	it('should update one widget', function(done) {
		api.put('/widgets/2')
		.set('Accept', 'application/json')
		.send({
			id: 2,
			name: 'Widget #2',
			description: 'The second (modified) widget',
			price: 1.99
		})
		.expect(200)
		.end(function(err, res) {
			done();
		});
	});

	it('should return a 404 when trying to update an item that doesn\'t exist', function(done) {
		api.put('/widgets/5')
		.set('Accept', 'application/json')
		.send({
			id: 5,
			name: 'Widget #5',
			description: 'The fifth widget',
			price: 3.99
		})
		.expect(404)
		.end(function(err, res) {
			done();
		});
	});

	it('should reject PUT requests that don\'t conform to the specified schema', function(done) {
		api.post('/widgets')
		.set('Accept', 'application/json')
		.send({
			id: '2',
			name: 1234,
			description: 'The second widget',
			price: 1.99
		})
		.expect(400)
		.end(function(err, res) {
			done();
		});
	});

	it('should delete an item', function(done) {
		api.delete('/widgets/3')
		.set('Accept', 'application/json')
		.expect(200)
		.end(function(err, res) {
			api.get('/widgets/3')
			.expect(200)
			.end(function(err, res) {
				expect(res.body).to.have.property('items');
				expect(res.body.items).to.have.length(0);
				done();
			});
		});
	});

	it('should return a 404 when applying DELETE to entire collection', function(done) {
		api.delete('/widgets/')
		.set('Accept', 'application/json')
		.expect(404)
		.end(function(err, res) {
			api.get('/widgets/')
			.expect(200)
			.end(function(err, res) {
				expect(res.body).to.have.property('items');
				expect(res.body.items).to.have.length(3);
				done();
			});
		});
	});
});
