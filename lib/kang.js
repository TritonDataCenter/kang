/*
 * kang.js: aggregate distributed system state
 */

var mod_assert = require('assert');
var mod_http = require('http');
var mod_https = require('https');
var mod_net = require('net');
var mod_url = require('url');

var mod_jsprim = require('jsprim');
var mod_vasync = require('vasync');
var mod_restify = require('restify');

var mod_nutil = require('./nodeutil');

var VError = require('verror');

var knSourcesEnvVar = 'KANG_SOURCES';
var knDefaultUri = '/kang/snapshot';

var MILLISEC = 1000;

var IPV4_HOST = /^(\d+.\d+.\d+.\d+)(:.+)?$/;
var IPV6_HOST = /^\[([0-9a-f:]+)\](:.+)?$/;
var DOMAIN_HOST = /^([a-zA-Z0-9._-]+)(:.+)?$/;

/*
 * Public interface.
 */

/* client variables */
exports.knSourcesEnvVar = knSourcesEnvVar;

/* client entry points */
exports.knMakeSource = knMakeSource;
exports.knParseSources = knParseSources;
exports.knParseEnv = knParseEnv;
exports.knFetchAll = knFetchAll;
exports.knFetchSchema = knFetchSchema;

/* server entry points */
exports.knRestifyHandler = knRestifyHandler;
exports.knStartServer = knStartServer;

/* testing only */
exports.knMergeSnapshots = knMergeSnapshots;

/*
 * Parse a Kang host specification, which takes the form of a normal HTTP
 * URL with most components optional:
 *
 *    [http[s]://]host[:port][/uri]
 *
 * Returns an object with fields:
 *
 *	protocol	'http' or 'https' [http]
 *
 *	host		hostname
 *
 *	port		port number [80 for http, 443 for https]
 *
 *	path		URI of Kang snapshot [/status/snapshot]
 */
function knMakeSource(str)
{
	var protocol, host, portstr, port, uri, c, matched;

	if (mod_jsprim.startsWith(str, 'https://')) {
		protocol = 'https';
		port = 443;
		str = str.substr('https://'.length);
	} else {
		protocol = 'http';
		port = 80;

		if (mod_jsprim.startsWith(str, 'http://'))
			str = str.substr('http://'.length);
	}

	c = str.indexOf('/');
	if (c == -1) {
		uri = knDefaultUri;
	} else {
		uri = str.substr(c);
		str = str.substr(0, c);
	}

	if ((matched = IPV4_HOST.exec(str)) !== null) {
		host = matched[1];
		portstr = matched[2];
		if (!mod_net.isIPv4(host)) {
			throw new Error('bad IPv4 address: ' +
			    JSON.stringify(host));
		}
	} else if ((matched = IPV6_HOST.exec(str)) !== null) {
		host = matched[1];
		portstr = matched[2];
		if (!mod_net.isIPv6(host)) {
			throw new Error('bad IPv6 address: ' +
			    JSON.stringify(host));
		}
	} else if ((matched = DOMAIN_HOST.exec(str)) !== null) {
		host = matched[1];
		portstr = matched[2];
	} else {
		throw (new Error('no host specified'));
	}

	if (portstr !== undefined) {
		mod_assert.equal(portstr[0], ':');
		portstr = portstr.slice(1);
		port = mod_jsprim.parseInteger(portstr, { allowSign: false });

		if (port instanceof Error) {
			throw (new VError(port, 'invalid port'));
		}

		if (port < 1 || port > 65535) {
			throw (new Error('invalid port: ' +
			    portstr + ' (must be in range 1-65535)'));
		}
	}

	return ({
		protocol: protocol,
		host: host,
		port: port,
		path: uri
	});
}

/*
 * Parse a series of host specifications separated by commas.
 */
function knParseSources(str)
{
	var pieces, i, rv;

	pieces = str.split(',');
	rv = [];

	for (i = 0; i < pieces.length; i++) {
		if (pieces[i].length === 0)
			continue;

		rv.push(knMakeSource(pieces[i]));
	}

	return (rv);
}

/*
 * Parse the KANG_SOURCES environment variable.
 */
function knParseEnv(envvar)
{
	if (envvar === undefined)
		envvar = knSourcesEnvVar;

	if (!process.env[envvar])
		return ([]);

	return (knParseSources(process.env[envvar]));
}

function knValidateSources(sources)
{
	mod_assert.ok(sources !== undefined, '"sources" must be specified');
	mod_assert.ok(Array.isArray(sources), '"sources" must be an array');

	sources.forEach(function (source) {
		mod_assert.equal(typeof (source['host']), 'string');
		mod_assert.equal(typeof (source['path']), 'string');
		mod_assert.ok(source['protocol'] == 'http' ||
		    source['protocol'] == 'https');
		mod_assert.equal(typeof (source['port']), 'number');
	});
}

/*
 * Public entry point for fetching a bunch of snapshots and returning the
 * merged object.  Arguments include:
 *
 *	sources		array of sources, as defined above for knMakeSource.
 *			Each source is usually obtained via knParseEnv or
 *			knMakeSource on a command-line option.
 *
 *	clientOptions	optional arguments for restify client (e.g.,
 *			connectTimeout).
 */
function knFetchAll(args, callback)
{
	var sources;

	sources = args['sources'];
	knValidateSources(sources);

	knFetchSnapshots(sources, args['clientOptions'] || {},
	    function (err, snapshots) {
		if (snapshots)
			snapshots = knMergeSnapshots(snapshots);
		callback(err, snapshots);
	    });
}

/*
 * Fetch snapshots for each of the given sources. Callback is invoked as
 * callback(err, snapshots), where 'err' is defined if we failed to fetch at
 * least one snapshot, and 'snapshots' is an array of returned snapshots.
 * (Unlike the more common pattern, both 'err' and 'snapshots' may be returned.)
 */
function knFetchSnapshots(sources, clientOptions, callback)
{
	knFetchMany(sources, clientOptions, knFetchSnapshot, callback);
}

function knFetchMany(sources, clientOptions, func, callback)
{
	var tasks, i;

	tasks = sources.map(function (source) {
	    return (func.bind(null, source, clientOptions));
	});

	mod_vasync.parallel({ 'funcs': tasks }, function (err, rv) {
		var snapshots, snapshot;

		snapshots = [];

		for (i = 0; i < rv['operations'].length; i++) {
			if (rv['operations'][i]['status'] != 'ok')
				continue;

			snapshot = rv['operations'][i]['result'];
			snapshot['source'] = sources[i];
			snapshots.push(snapshot);
		}

		callback(err, snapshots);
	});
}

/*
 * Fetch a single snapshot from a single server.
 */
function knFetchSnapshot(source, clientOptions, callback)
{
	knFetch(source, clientOptions, source['path'], callback);
}

function knFetch(source, clientOptions, path, callback)
{
	var url, client, options;

	url = mod_url.format({
	    'protocol': source['protocol'],
	    'hostname': source['host'],
	    'port': source['port']
	});

	options = {
	    'url': url,
	    'retry': false
	};

	for (var k in clientOptions) {
		if (!options.hasOwnProperty(k))
			options[k] = clientOptions[k];
	}

	client = mod_restify.createJsonClient(options);

	client.get(path, function (err, request, response, obj) {
		if (err) {
			callback(err);
			return;
		}

		if (response.statusCode != 200) {
			callback(new Error('response code ' +
			    response.statusCode));
			return;
		}

		callback(null, obj);

		/* This could be reused. */
		client.close();
	});
}

/*
 * Public interface representing a unified snapshot based on data retrieved from
 * multiple sources.  Each snapshot has a set of objects partitioned into groups
 * called types.
 */
function knSnapshot()
{
	this.cs_objects = {};
}

knSnapshot.prototype.types = function ()
{
	return (Object.keys(this.cs_objects));
};

knSnapshot.prototype.list = function (type)
{
	if (!(type in this.cs_objects))
		return ([]);

	return (Object.keys(this.cs_objects[type]));
};

knSnapshot.prototype.lookup = function (type, ident)
{
	if (!(type in this.cs_objects) ||
	    !(ident in this.cs_objects[type]))
		return ([]);

	return (this.cs_objects[type][ident]);
};

knSnapshot.prototype.lookupFirst = function (type, ident)
{
	var rv;

	rv = this.lookup(type, ident);
	if (rv && rv.length > 0)
		return (rv[0]);
	return (undefined);
};

/*
 * Parses a query string into its component parts.  Query strings have the form:
 *
 *    typename[:identifier] (e.g., "host" or "host:127.0.0.1")
 *
 * A query that includes only a typename refers to all objects having that type.
 * A query that includes an identifier refers to all metadata objects for the
 * object with that identifier.  The returned object has one or two fields:
 *
 *	type	name of the type
 *
 *	id	individual object identifier
 *		(only present if an id was specified in the query string)
 */
knSnapshot.prototype.queryParse = function (query)
{
	var c = query.indexOf(':');

	if (c == -1)
		return ({ 'type': query });

	return ({
	    'type': query.substring(0, c),
	    'id': query.substring(c + 1)
	});
};

/*
 * Given a query (see queryParse), return information about the matching
 * objects in tabular form.  The returned object contains two fields:
 *
 *	fields		Ordered array of strings denoting the set of top-level
 *			keys contained in the returned objects.  This is useful
 *			for tools to know what format to expect.
 *
 *	objects		Array of objects matching the query, where each object
 *			contains some of the keys listed in "fields".
 */
knSnapshot.prototype.query = function (querystr)
{
	var snapshot = this;
	var query = this.queryParse(querystr);
	var keys, objects, fields;

	if (!query.hasOwnProperty('id')) {
		if (query['type'] == 'type') {
			objects = this.types().map(function (type) {
				return ({ 'type': type });
			});
		} else {
			objects = [];
			keys = this.list(query['type']);
			keys.forEach(function (key) {
				objects = objects.concat(snapshot.lookup(
				    query['type'], key));
			});
		}
	} else {
		objects = this.lookup(query['type'], query['id']);
	}

	fields = this.fieldsFor(query['type'], objects);
	return ({ 'fields': fields, 'objects': objects });
};

knSnapshot.prototype.fieldsFor = function (type, objects)
{
	var fields, rv;

	fields = {};

	objects.forEach(function (obj) {
		for (var key in obj)
			fields[key] = true;
	});

	delete (fields[type]);
	rv = Object.keys(fields).sort();
	rv.unshift(type);
	return (rv);
};

knSnapshot.prototype.links = function (obj)
{
	var rv = [];
	return (this.linksHelper(obj, rv));
};

/* [private] */
knSnapshot.prototype.linksHelper = function (obj, links)
{
	var type, ident, link, key, i;

	if (typeof (obj) == 'string') {
		i = obj.indexOf(':');
		if (i == -1)
			return (links);

		type = obj.substring(0, i);
		ident = obj.substring(i + 1);
		link = this.lookup(type, ident);
		if (link.length > 0)
			links.push(type + ':' + ident);
		return (links);
	}

	if (typeof (obj) != 'object')
		return (links);

	if (Array.isArray(obj)) {
		for (i = 0; i < obj.length; i++)
			this.linksHelper(obj[i], links);

		return (links);
	}

	for (key in obj) {
		this.linksHelper(key, links);
		this.linksHelper(obj[key], links);
	}

	return (links);
};

/* [private] */
knSnapshot.prototype.add = function (type, ident, obj)
{
	if (!(type in this.cs_objects))
		this.cs_objects[type] = {};

	if (!(ident in this.cs_objects[type]))
		this.cs_objects[type][ident] = [];

	if (typeof (obj) == 'string')
		obj = { 'body': obj };

	obj[type] = ident;
	this.cs_objects[type][ident].push(obj);
};

/*
 * Returns a snapshot consolidated from the given snapshots. The resulting
 * object can be queried for various types of data.
 */
function knMergeSnapshots(snapshots)
{
	var rv, errors, srvname, i, snap;

	rv = new knSnapshot();
	errors = [];

	for (i = 0; i < snapshots.length; i++) {
		snap = snapshots[i];

		if (!('service' in snap)) {
			errors.push([ snap, 'missing "service" property' ]);
			continue;
		}

		srvname = snap['service']['name'];

		if ('component' in snap['service'])
			srvname += '.' + snap['service']['component'];

		snap['service']['source'] =
		    snap['source']['protocol'] + '://' +
		    snap['source']['host'] + ':' + snap['source']['port'] +
		    snap['source']['path'];
		srvname += '.' + snap['service']['ident'];
		rv.add('service', srvname, snap['service']);

		if ('stats' in snap)
			rv.add('stats', srvname, snap['stats']);

		if (!('types' in snap))
			continue;

		snap['types'].forEach(function (type) {
			var objects, key;

			objects = snap[type];

			for (key in objects) {
				objects[key]['origin'] = srvname;
				rv.add(type, key, objects[key]);
			}
		});
	}

	return (rv);
}

/*
 * Public entry point for fetching a bunch of schemas and returning the merged
 * object.  Arguments include:
 *
 *	sources		array of sources, as defined above for knMakeSource.
 *			Each source is usually obtained via knParseEnv or
 *			knMakeSource on a command-line option.
 */
function knFetchSchema(args, callback)
{
	var sources = args['sources'];
	knValidateSources(sources);
	knFetchMany(sources, {}, knFetchSchemaOne, function (err, schemas) {
		if (err)
			callback(err);
		else
			callback(null, knMergeSchemas(schemas));
	});
}

function knFetchSchemaOne(source, clientOptions, callback)
{
	var path, p;

	if ((p = source['path'].indexOf('/snapshot')) == -1 ||
	    p + '/snapshot'.length != source['path'].length) {
		callback(new Error('don\'t know how to infer schema URL ' +
		    'from ' + source['path']));
		return;
	}

	path = source['path'].substr(0, p) + '/schema';
	knFetch(source, clientOptions, path, callback);
}

function knMergeSchemas(schemas)
{
	var rv, i, schema, k;

	rv = { 'types': {} };
	for (i = 0; i < schemas.length; i++) {
		schema = schemas[i];

		/* TODO use json-schema to validate response */
		if (!schema.hasOwnProperty('types') ||
		    !Array.isArray(schema['types']))
			continue;

		if (!schema.hasOwnProperty('schemas') ||
		    typeof (schema['schemas']) != 'object')
			continue;

		var service = schema['service']['name'];
		var component = schema['service']['component'];

		for (k in schema['schemas']) {
			if (!rv['types'].hasOwnProperty(k))
				rv['types'][k] = {};

			if (!(rv['types'][k].hasOwnProperty(service)))
				rv['types'][k][service] = {};

			if (!(rv['types'][k][service].hasOwnProperty(
			    component)))
				rv['types'][k][service][component] =
				    schema['schemas'][k];
		}
	}

	return (rv);
}

/*
 * Returns an HTTP request handler function (for use with restify) that
 * implements the kang API.  Arguments are specified via the "args" object,
 * whose properties must include:
 *
 *	uri_base		Base URI for all requests. 404 errors will be
 *				emitted for any request whose URI does not start
 *				with "uri_base".
 *
 *	service_name		Global name of this service (not this instance)
 *
 *	version			Service version
 *
 *	ident			Global name of this service instance
 *				(suggested: os.hostname())
 *
 *	list_types()		Function that returns a list of object types
 *
 *	list_objects(type)	Function that returns a list of object ids for a
 *				valid object type
 *
 *	get(type, ident)	Function that returns a JSON-style object for a
 *				given type and identifier.
 *
 * The following properties may also be specified:
 *
 *	component	Type of component within this service, for services with
 *			different types of components
 *
 *	stats()		Function that returns a JSON-style object with arbitrary
 *			stats about this instance (usually error and performance
 *			counters).
 *
 *	schema(type)	Returns a schema for the given object type
 */
function knRestifyHandler(args)
{
	var svc = new knServiceContext(args);

	return (function (request, response, next) {
		knHandleRequest(svc, request, response, next);
	});
}

/*
 * Starts a restify server.  The arguments match those of caRestifyHandler, with
 * the following addition:
 *
 *	port			port number on which to listen (default: 80)
 *
 * "callback" is invoked once the server has finished starting up.
 */
function knStartServer(args, callback)
{
	var host, port, server;

	if (!mod_restify)
		mod_restify = require('restify');

	mod_assert.ok('uri_base' in args);
	mod_assert.equal('string', typeof (args['uri_base']));

	port = 'port' in args ? args['port'] : 80;
	host = 'host' in args ? args['host'] : '::';
	server = mod_restify.createServer({ serverName: 'Kang' });
	server.get(new RegExp(args['uri_base'] + '/.*'),
	    knRestifyHandler(args));
	server.listen(port, host, function () { callback(null, server); });
}

/*
 * Arguments match those of knRestifyHandler.  This constructor validates the
 * arguments, stores copies, and pregenerates some fields of response bodies
 * that we know won't change (like the start time).
 */
function knServiceContext(args)
{
	mod_assert.equal(typeof (args['uri_base']), 'string',
	    '"uri_base" must be a string');
	mod_assert.equal(typeof (args['service_name']), 'string',
	    '"service_name" must be a string');
	mod_assert.equal(typeof (args['version']), 'string',
	    '"version" must be a string');
	mod_assert.equal(typeof (args['ident']), 'string',
	    '"ident" must be a string');
	mod_assert.equal(typeof (args['list_types']), 'function',
	    '"list_types" must be a function');
	mod_assert.equal(typeof (args['list_objects']), 'function',
	    '"list_objects" must be a function');
	mod_assert.equal(typeof (args['get']), 'function',
	    '"get" must be a function');

	this.kns_service = {
		name: args['service_name'],
		ident: args['ident'],
		version: args['version']
	};

	if ('component' in args) {
		mod_assert.equal(typeof (args['component']), 'string',
		    '"component" must be a string');
		this.kns_service['component'] = args['component'];
	}

	this.kns_list_types = args['list_types'];
	this.kns_list_objects = args['list_objects'];
	this.kns_get = args['get'];

	if ('stats' in args) {
		mod_assert.equal(typeof (args['stats']), 'function',
		    '"stats" must be a function');
		this.kns_stats = args['stats'];
	}

	if ('schema' in args) {
		mod_assert.equal(typeof (args['schema']), 'function',
		    '"schema" must be a function');
		this.kns_schema = args['schema'];
	}

	this.kns_uri_base = mod_nutil.chopSlashes(args['uri_base']);
	this.kns_started = new Date(
	    Date.now() - process.uptime() * MILLISEC).toISOString();
}

/*
 * Generates the body of an HTTP response for the snapshot.
 */
knServiceContext.prototype.snapshot = function ()
{
	var ctx, body, key, tmp;

	ctx = this;

	body = {};
	body['service'] = this.kns_service;
	body['stats'] = {};

	if (this.kns_stats) {
		tmp = this.kns_stats();
		for (key in tmp)
			body['stats'][key] = tmp[key];
	}

	body['stats']['started'] = this.kns_started;
	body['stats']['memory'] = process.memoryUsage();

	body['types'] = this.kns_list_types();
	mod_assert.ok(Array.isArray(body['types']),
	    'kang types must be an array');
	body['types'].forEach(function (type) {
		var objects;

		mod_assert.equal(typeof (type), 'string',
		    'each kang type must be a string');

		body[type] = {};
		objects = ctx.kns_list_objects(type);
		mod_assert.ok(Array.isArray(objects),
		    'kang object list must be an array');
		objects.forEach(function (obj) {
		    body[type][obj] = ctx.kns_get(type, obj);
		});
	});

	return (body);
};

/*
 * Generates the body of an HTTP response for the schema.
 */
knServiceContext.prototype.schema = function ()
{
	var ctx = this;
	var body;

	if (!this.kns_schema)
		return ({});

	body = {};
	body['service'] = this.kns_service;
	body['types'] = this.kns_list_types();
	body['schemas'] = {};
	body['types'].forEach(function (type) {
		body['schemas'][type] = ctx.kns_schema(type);
	});
	return (body);
};

function knHandleRequest(svc, request, response, next)
{
	var body;
	var path;

	/*
	 * In older versions of restify, "path" was a regular property.
	 */
	if (typeof (request.path) == 'function')
		path = request.path();
	else
		path = request.path;

	if (path != svc.kns_uri_base + '/snapshot' &&
	    path != svc.kns_uri_base + '/schema') {
		response.send(404);
		next();
		return;
	}

	if (request.method != 'GET') {
		response.send(405);
		next();
		return;
	}

	if (path == svc.kns_uri_base + '/snapshot')
		body = svc.snapshot();
	else
		body = svc.schema();

	response.send(200, body);
	next();
}
