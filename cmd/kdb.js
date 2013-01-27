#!/usr/bin/env node

/*
 * kdb.js: interactive command-line interface for the Kang API
 */

var mod_assert = require('assert');
var mod_repl = require('repl');
var mod_vm = require('vm');

var mod_getopt = require('posix-getopt');
var mod_kang = require('../lib/kang');
var mod_strsplit = require('strsplit');

var KNG_USAGE = [
    'Usage: kdb [-h host1[host2...]]',
    '',
    'Starts an interactive Kang debugging session.',
    '',
    'Options:',
    '',
    '    -h     remote Kang hosts, as comma-separated list of',
    '           [http[s]]://host[:port][/uri]'
].join('\n');

var kdb_hosts = [];			/* list of sources to query */
var kdb_snapshots = [];			/* snapshots */
var kdb_fetchargs;
var kdb_current_snapshot;
var kdb_repl;

function main()
{
	var parser, option;

	parser = new mod_getopt.BasicParser('h:', process.argv);

	while ((option = parser.getopt()) !== undefined) {
		if (option.error || option.option == '?')
			usage();

		if (option.option == 'h') {
			kdb_hosts = kdb_hosts.concat(
			    mod_kang.knParseSources(option.optarg));
			continue;
		}
	}

	if (parser.optind() !== process.argv.length)
		usage();

	if (kdb_hosts.length === 0)
		kdb_hosts = mod_kang.knParseEnv();

	if (kdb_hosts.length === 0)
		usage('no hosts specified via -h or KANG_SOURCES');

	kdb_fetchargs = { sources: kdb_hosts };
	fetch(start);
}

function usage(message)
{
	if (message)
		console.error('error: %s', message);

	console.error(KNG_USAGE);
	process.exit(1);
}

function fetch(callback)
{
	mod_kang.knFetchAll(kdb_fetchargs, function (err, snapshot) {
		if (err) {
			console.error('failed to fetch snapshots: %s',
			    err.message);
			callback();
			return;
		}

		kdb_snapshots.push(snapshot);
		kdb_current_snapshot = kdb_snapshots.length - 1;
		callback();
	});
}

function start()
{
	kdb_repl = mod_repl.start({
	    'eval': replEval,
	    'ignoreUndefined': true
	});

	replSnapshot(0);
}

function replEval(cmd, context, filename, callback)
{
	var parts;

	/* XXX This can't be the right way to do this... */
	cmd = cmd.substr(1, cmd.length - 3);
	parts = mod_strsplit(cmd, /\s+/, 2);

	if (parts[0] === '') {
		callback();
		return;
	}

	/* XXX clean this up */
	/* XXX add walker/print/pipeline like mdb */
	if (parts[0] == 'update') {
		replUpdate(callback);
		return;
	}

	if (parts[0] == 'print') {
		callback(null, replPrint(parts[1]));
		return;
	}

	if (parts[0] == 'list' || parts[0] == 'ls') {
		callback(null, replList(parts[1]));
		return;
	}

	if (parts[0] == 'snapshots')
		replSnapshots();
	else if (parts[0] == 'snapshot')
		replSnapshot(parts[1]);
	else if (parts[0] == 'help')
		replHelp();
	else
		console.error('unknown command: %s', cmd);

	callback();
}

function replUpdate(callback)
{
	fetch(function () {
		console.log('retrieved snapshot %s', kdb_snapshots.length - 1);
		callback();
	});
}

function replSnapshot(i)
{
	if (i === undefined || i.length === 0) {
		console.log('browsing snapshot %s', kdb_current_snapshot);
		return;
	}

	i = parseInt(i, 10);
	if (isNaN(i)) {
		console.error('usage: snapshot <index>');
		return;
	}

	if (i < 0 || i >= kdb_snapshots.length) {
		console.error('snapshot: index out of range');
		return;
	}

	kdb_current_snapshot = i;
}

function replSnapshots()
{
	for (var i = 0; i < kdb_snapshots.length; i++)
		console.log(i);
}

function replEvalExpr(expr)
{
	var base, vm, result;

	base = kdb_snapshots[kdb_current_snapshot].cs_objects;

	if (expr === undefined || expr.length === 0)
		return (base);

	try {
		vm = mod_vm.createContext(base);
		result = mod_vm.runInContext(expr, vm);
		return (result);
	} catch (ex) {
		console.error('error: ' + ex.message);
		return (undefined);
	}
}

function replList(expr)
{
	var result = replEvalExpr(expr);

	if (typeof (result) != 'object' || result === null)
		return (undefined);

	if (Array.isArray(result))
		return (result);

	return (Object.keys(result).sort());
}

function replPrint(expr)
{
	return (replEvalExpr(expr));
}

var replHelpMessage = [
    'kdb is the Kang Debugger, used to interactively browse snapshots of ',
    'distributed system state.  The following commands are available:',
    '',
    '    help		Print this help message',
    '',
    '    list <expr>	Evaluate <expr> as with print and list elements.',
    '',
    '    print <expr>   Evaluate the JavaScript expression <expr> and print',
    '                   the result.  The expression is evaluated in the ',
    '			context of the current snapshot.  Available globals ',
    '                   include the list of available types.',
    '',
    '    snapshot	Show current snapshot',
    '',
    '    snapshot <i>	Switch to snapshot <i>',
    '',
    '    snapshots	Show available snapshots',
    '',
    '    update		Fetch a new snapshot (and switch to it)'
].join('\n');

function replHelp()
{
	console.log(replHelpMessage);
}

main();
