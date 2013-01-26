/*
 * demo.js: static-file node HTTP server for demos
 *
 * Usage: node demo.js [port]
 *
 *    Sets up a web server on the given port (or port 80) serving static files
 *    out of the given path.
 */

var mod_fs = require('fs');
var mod_http = require('http');
var mod_path = require('path');
var mod_url = require('url');

var mod_kang = require('../../lib/kang');

var dd_index = 'index.htm';
var dd_cwd = __dirname;
var dd_port = 80;

var i;

for (i = 2; i < process.argv.length; i++) {
	dd_port = parseInt(process.argv[i], 10);
	if (isNaN(dd_port)) {
		console.error('usage: node demo.js [port]');
		process.exit(1);
	}
}

mod_http.createServer(function (req, res) {
	var uri = mod_url.parse(req.url).pathname;
	var path;
	var filename;

	path = (uri == '/') ? dd_index : uri;

	if (path == '/proxy')
		return (kangProxy(req, res));

	filename = mod_path.join(dd_cwd, path);

	mod_fs.readFile(filename, function (err, file) {
		if (err) {
			res.writeHead(404);
			res.end();
			return;
		}

		res.writeHead(200);
		res.end(file);
	});
}).listen(dd_port, function () {
	console.log('HTTP server started on port ' + dd_port);
});

function kangProxy(request, response)
{
	var hosts = mod_url.parse(request.url, true).query.host;
	var allsources, validsources;

	if (!hosts) {
		response.writeHead(200);
		return (response.end(JSON.stringify({
			sources: [], snapshot: {}
		})));
	}

	if (!Array.isArray(hosts))
		hosts = [ hosts ];

	allsources = [];
	validsources = [];

	hosts.forEach(function (host) {
		try {
			var source = mod_kang.knMakeSource(host);
			validsources.push(source);
			allsources.push({ host: host, source: source });
		} catch (ex) {
			allsources.push({ host: host, error: ex.message });
		}
	});

	mod_kang.knFetchSchema({ sources: validsources }, function (err, schema) {
		var rv = {
			sources: allsources,
		};

		if (err)
			rv['error'] = err;
		rv['schema'] = schema;

		mod_kang.knFetchAll({ sources: validsources },
		    function (err, snapshot) {
			if (err)
				rv['error'] = err;
			rv['snapshot'] = snapshot;

			response.writeHead(200);
			response.end(JSON.stringify(rv));
		    });
	});
}
