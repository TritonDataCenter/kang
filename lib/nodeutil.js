/*
 * nodeutil.js: miscellaneous utility routines
 */

var mod_assert = require('assert');

exports.startsWith = function startsWith(str, prefix)
{
	var i;

	if (prefix.length > str.length)
		return (false);

	for (i = 0; i < prefix.length; i++) {
		if (str[i] != prefix[i])
			return (false);
	}

	return (true);
};

exports.chopSlashes = function chopSlashes(str)
{
	var i;

	for (i = str.length - 1; i >= 0; i--) {
		if (str[i] != '/')
			break;
	}

	if (i != str.length - 1)
		return (str.substr(0, i + 1));

	return (str);
};

/*
 * Runs a series of functions that complete asynchronously and aggregates the
 * results. Each function will be invoked as callback(err, result).  When all
 * functions have been completed, the "callback" argument will be invoked with
 * the following arguments:
 *
 *	results		An array of objects describing the results of each
 *			callback function. The order of these results matches
 *			the order of the functions themselves. Each entry
 *			contains one field.  That field will either be 'result'
 *			or 'error'. When the field is 'error' the object it
 *			points to will be an error that the function passed to
 *			the callback. If the function completed successfully the
 *			'result' field will contain the results passed to the
 *			callback.
 *
 *	nerrors		The number of errors that were found
 *
 *	errlocs		An array of indices into "results" for each result with
 *			an error.
 */
exports.runParallel = function runParallel(functions, callback)
{
	var i, nfuncs, res, mkcb, errs;

	mod_assert.ok(functions instanceof Array,
	    '"functions" should be an array');

	if (functions.length === 0) {
		setTimeout(function () {
			callback({ results: [], nerrors: 0, errlocs: [] });
		}, 0);
		return;
	}

	for (i = 0; i < functions.length; i++)
		mod_assert.equal(typeof (functions[i]), 'function');

	mod_assert.equal(typeof (callback), 'function');

	nfuncs = functions.length;
	errs = [];
	res = new Array(nfuncs);

	mkcb = function (j) {
		return (function (err, result) {
			if (err) {
				errs.push(j);
				res[j] = { error: err };
			} else {
				res[j] = { result: result };
			}

			if (--nfuncs === 0) {
				callback({
					results: res,
					nerrors: errs.length,
					errlocs: errs
				});
			}
		});
	};

	for (i = 0; i < functions.length; i++)
		functions[i](mkcb(i));
};
