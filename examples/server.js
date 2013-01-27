/*
 * example/server.js: example restify-based kang server
 */

var mod_assert = require('assert');
var mod_kang = require('../lib/kang');
var mod_os = require('os');
var mod_restify = require('restify');

var port = 8080;

if (process.argv.length > 2)
	port = parseInt(process.argv[2], 10);

if (isNaN(port)) {
	console.error('usage: node server.js [port number]');
	process.exit(1);
}

var args = {
    uri_base: '/kang',
    port: port,
    service_name: 'kang_example',
    version: '0.0.1',
    ident: mod_os.hostname(),
    list_types: knsListTypes,
    list_objects: knsListObjects,
    get: knsGetObject,
    stats: knsStats
};

mod_kang.knStartServer(args, function (err, server) {
	if (err)
		throw (err);

	var addr = server.address();
	console.log('server listening at http://%s:%d',
	    addr['address'], addr['port']);
});

var kns_data = {
	'student': {
		'bart': { 'surname': 'simpson', 'role': 'clown',
		    'siblings': [ 'lisa' ] },
		'lisa': { 'surname': 'simpson', 'role': 'geek' },
		'nelson': { 'surname': 'muntz', 'role': 'bully' },
	},
	'teacher': {
		'krabappel': { 'so': 'skinner' },
		'hoover': { 'so': 'unknown' },
		'skinner': { 'nemesis': 'student:bart' }
	},
	'staff': {
		'willie': 'groundskeeper willie',
		'doris': 'lunchlady doris'
	}
};

var kns_stats = {
	start: Date.now(),
	lists: 0
};

function knsListTypes()
{
	kns_stats['lists']++;
	return (Object.keys(kns_data));
}

function knsListObjects(type)
{
	/* We cannot be invoked on types we didn't list above. */
	mod_assert.ok(kns_data.hasOwnProperty(type));
	return (Object.keys(kns_data[type]));
}

function knsGetObject(type, ident)
{
	/* We cannot be invoked for objects that we didn't list above. */
	mod_assert.ok(kns_data.hasOwnProperty(type));
	mod_assert.ok(kns_data[type].hasOwnProperty(ident));
	return (kns_data[type][ident]);
}

function knsStats()
{
	return (kns_stats);
}
