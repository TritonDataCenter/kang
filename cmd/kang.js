#!/usr/bin/env node

/*
 * kang.js: command-line interface for the Kang API
 */

var mod_assert = require('assert');
var mod_getopt = require('posix-getopt');

var mod_cli = require('../lib/cliutil');
var mod_kang = require('../lib/kang');

var KNG_USAGE = [
    'Usage: kang [-h host1[host2...]] [-l] [-o col1[,col2...] query',
    '       kang [-h host1[host2...]] -f "json" query',
    '',
    'Queries remote Kang servers for objects matching "query" and prints out',
    'the results.  The following options are supported:',
    '',
    '    -f     output format (default: human-readable text)',
    '    -h     remote Kang hosts, as comma-separated list of',
    '           [http[s]://]host[:port][/uri]',
    '    -l     long listing (emit object details, not just identifiers)',
    '    -o     column names to print, as comma-separated list (implies -l)',
    '',
    '"query" is an object type or identifier, as in:',
    '',
    '    client             all objects of type "client"',
    '    client:localhost   all objects of type "client" with id "localhost"',
    '',
    'The special query "type" lists all available types.'
].join('\n');

/*
 * Available output formatters
 */
var kng_output_formatters = {
    'text': kngOutputText,
    'json': kngOutputJson
};

/*
 * User arguments
 */
var kng_debug = false;			/* dump debug output */
var kng_long = false;			/* long listing (extra details) */
var kng_hosts = [];			/* list of sources to query */
var kng_output = kngOutputText;		/* desired output format */
var kng_query;				/* query string */
var kng_cols;				/* desired columns */

function main()
{
	var parser, option, fetchargs;

	parser = new mod_getopt.BasicParser('h:f:o:dl', process.argv);

	while ((option = parser.getopt()) !== undefined) {
		if (option.error || option.option == '?')
			usage();

		if (option.option == 'd') {
			kng_debug = true;
			continue;
		}

		if (option.option == 'f') {
			if (!kng_output_formatters.hasOwnProperty(
			    option.optarg))
				usage('unrecognized output format: ' +
				    option.optarg);
			kng_output = kng_output_formatters[option.optarg];
			continue;
		}

		if (option.option == 'h') {
			kng_hosts = kng_hosts.concat(
			    mod_kang.knParseSources(option.optarg));
			continue;
		}

		if (option.option == 'l') {
			kng_long = true;
			continue;
		}

		if (option.option == 'o') {
			if (kng_cols === undefined)
				kng_cols = [];
			kng_long = true;
			kng_cols = kng_cols.concat(
			    option.optarg.split(','));
			continue;
		}
	}

	if (parser.optind() === process.argv.length)
		usage();

	kng_query = process.argv[parser.optind()];

	if (kng_hosts.length === 0)
		kng_hosts = mod_kang.knParseEnv();

	if (kng_hosts.length === 0)
		usage('no hosts specified via -h or KANG_SOURCES');

	fetchargs = { sources: kng_hosts };

	mod_kang.knFetchAll(fetchargs, function (err, snapshot) {
		if (err) {
			console.error('failed to fetch snapshots: %s',
			    err.message);
			process.exit(1);
		}

		kng_output(snapshot);
	});
}

function usage(message)
{
	if (message)
		console.error('error: %s', message);

	console.error(KNG_USAGE);
	process.exit(1);
}

function kngOutputText(snapshot)
{
	var results = snapshot.query(kng_query);
	var cols;

	cols = kng_cols !== undefined ? kng_cols : results['fields'];
	if (!kng_long)
		cols = [ cols[0] ];

	mod_cli.emitTable(process.stdout, cols, results['objects'], kng_debug);
}

function kngOutputJson(snapshot)
{
	var results = snapshot.query(kng_query)['objects'];
	process.stdout.write(JSON.stringify(results, null, '\t') + '\n');
}

main();
