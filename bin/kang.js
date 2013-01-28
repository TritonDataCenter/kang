#!/usr/bin/env node

/*
 * kang.js: interactive command-line interface for the Kang API
 */

var mod_assert = require('assert');
var mod_repl = require('repl');
var mod_util = require('util');
var mod_vm = require('vm');

var mod_getopt = require('posix-getopt');
var mod_kang = require('../lib/kang');
var mod_strsplit = require('strsplit');

var KNG_USAGE = [
    'Usage: kang [-h host1[host2...]]',
    '',
    'Starts an interactive Kang debugging session.',
    '',
    'Options:',
    '',
    '    -h     remote Kang hosts, as comma-separated list of',
    '           [http[s]://]host[:port][/uri]'
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

	replSnapshot(null, [ 'snapshot', '0' ], function () {});
}

var replCmds = {
    '': replNoop,
    'help': replHelp,
    'update': replUpdate,
    'snapshot': replSnapshot,
    'snapshots': replSnapshots,

    'print': false,
    'walk': false
};

function replEval(cmdline, context, filename, callback)
{
	var parts, cmd, dot;

	/* XXX This can't be the right way to do this... */
	cmdline = cmdline.substr(1, cmdline.length - 3);
	parts = mod_strsplit.strsplit(cmdline, /\s+/, 2);
	cmd = parts[0];

	if (!replCmds.hasOwnProperty(cmd)) {
		console.error('unknown command: %s', cmdline);
		callback();
		return;
	}

	if (cmd != 'print' && cmd != 'walk') {
		replCmds[cmd](cmd, parts, callback);
		return;
	}

	dot = kdb_snapshots[kdb_current_snapshot].cs_objects;
	replEvalPipeline(dot, cmdline, callback);
}

function replNoop(_, __, callback)
{
	callback();
}

var replHelpMessage = [
    'kang is the Kang Debugger, used to interactively browse snapshots of ',
    'distributed system state.  The following commands are available:',
    '',
    '    help           Print this help message',
    '',
    '    print <expr>   Evaluate the JavaScript expression <expr> in the ',
    '                   context of the current object and print the result. ',
    '',
    '    snapshot       Show current snapshot',
    '',
    '    snapshot <i>   Switch to snapshot <i>',
    '',
    '    snapshots      Show available snapshots',
    '',
    '    update         Fetch a new snapshot (and switch to it)',
    '',
    '    walk <expr>    With no arguments, walks all properties of the ',
    '                   current object and prints them.  With <expr>, walks ',
    '                   the properties, evalutes <expr> for each one, and ',
    '                   prints the result.',
    '',
    '"print" and "walk" can be combined in Unix-style pipelines.',
    '',
    'Example 1: print top-level "student" property of the current snapshot:',
    '',
    '    > print student',
    '    { bart: ',
    '       [ { surname: \'simpson\',',
    '           role: \'clown\',',
    '           siblings: [Object],',
    '           student: \'bart\' } ],',
    '      lisa: [ { surname: \'simpson\', role: \'geek\', student: ' +
    '\'lisa\' } ],',
    '      nelson: [ { surname: \'muntz\', role: \'bully\', student: ' +
    '\'nelson\' } ] }',
    '',
    'Example 2: iterate top-level "student" values:',
    '    > walk student',
    '    [ { surname: \'simpson\',',
    '        role: \'clown\',',
    '        siblings: [ \'lisa\' ],',
    '        student: \'bart\' } ]',
    '    [ { surname: \'simpson\', role: \'geek\', student: \'lisa\' } ]',
    '    [ { surname: \'muntz\', role: \'bully\', student: \'nelson\' } ]',
    '',
    'Example 3: iterate elements of each of the top-level "student" values:',
    '    > walk student | walk',
    '    { surname: \'simpson\',',
    '      role: \'clown\',',
    '      siblings: [ \'lisa\' ],',
    '      student: \'bart\' }',
    '    { surname: \'simpson\', role: \'geek\', student: \'lisa\' }',
    '    { surname: \'muntz\', role: \'bully\', student: \'nelson\' }',
    '',
    'Example 4: print "surname" of each student:',
    '    > walk student | walk | print surname',
    '    simpson',
    '    simpson',
    '    muntz',
    '',
    'Example 5: walk siblings of each student:',
    '    > walk student | walk | walk siblings',
    '    lisa',
    '    error: siblings is not defined',
    '    error: siblings is not defined'
].join('\n');

function replHelp(_, __, callback)
{
	console.log(replHelpMessage);
	callback();
}

function replSnapshot(_, args, callback)
{
	if (args.length < 2) {
		console.log('browsing snapshot %s', kdb_current_snapshot);
		callback();
		return;
	}

	var i = parseInt(args[1], 10);

	if (isNaN(i))
		console.error('usage: snapshot <index>');
	else if (i < 0 || i >= kdb_snapshots.length)
		console.error('snapshot: index out of range');
	else
		kdb_current_snapshot = i;

	callback();
}

function replSnapshots(_, __, callback)
{
	for (var i = 0; i < kdb_snapshots.length; i++)
		console.log(i);

	callback();
}

function replUpdate(_, __, callback)
{
	fetch(function () {
		console.log('retrieved snapshot %s', kdb_snapshots.length - 1);
		callback();
	});
}

function replEvalPipeline(dot, cmdline, callback)
{
	if (cmdline === undefined)
		cmdline = 'print';

	/* XXX should handle quoted pipes */
	var exprs = mod_strsplit.strsplit(cmdline, '|', 2);
	replEvalOne(dot, exprs[0], exprs[1], callback);
}

function replEvalOne(dot, cmdline, rest, callback)
{
	var parts = mod_strsplit(
	    cmdline.replace(/(^[\s]+|[\s]+$)/g, ''), /\s+/, 2);
	var result;

	if (parts[0] == 'print') {
		console.log(replEvalExpr(dot, parts[1]));
		callback();
		return;
	}

	if (parts[0] != 'walk') {
		console.error('unknown command: %s', cmdline);
		callback();
		return;
	}

	result = replEvalExpr(dot, parts[1]);
	if (typeof (result) != 'object' || result === null) {
		callback();
		return;
	}

	var count, key;

	if (Array.isArray(result)) {
		if (result.length === 0) {
			callback();
			return;
		}

		count = result.length;
		result.forEach(function (elt) {
			replEvalPipeline(elt, rest, function () {
				if (--count === 0)
					callback();
			});
		});
		return;
	}

	count = 1;
	for (key in result) {
		count++;
		replEvalPipeline(result[key], rest, function () {
			if (--count === 0)
				callback();
		});
	}

	if (--count === 0)
		callback();
}

function replEvalExpr(dot, expr)
{
	var context, result;

	/*
	 * Ideally, commands would be executed with the global object set to the
	 * snapshot itself, and with "this" set to the same global object.  That
	 * way users could run "print this" to see the global scope, and "print
	 * this.service" to see the value of "service", or just "print service".
	 *
	 * Unfortunately, this does not appear achievable with the vm module's
	 * runIn[New]Context functions.  We *can* set the global context and
	 * "this" to the snapshot itself, allowing both "print service" and
	 * "print this.service" to work, but "print this" always prints "{}".
	 * In fact, this issue isn't superficial: if you iterate the properties
	 * of "this", you'll find there are none, but "this.service" still
	 * works.  This behavior is quite surprising, even to experienced
	 * JavaScript programmers.  As a result, we require users to use "self"
	 * for this purpose instead of "this".  We set the global "self"
	 * property to refer to the snapshot, and we also set global properties
	 * for all top-level properties of the snapshot.
	 */
	context = { 'self': dot };
	for (var k in dot)
		context[k] = dot[k];

	if (expr === undefined)
		expr = 'self';

	try {
		result = mod_vm.runInNewContext(expr, context);
		return (result);
	} catch (ex) {
		console.error('error: ' + ex.message);
		return (undefined);
	}
}

main();
