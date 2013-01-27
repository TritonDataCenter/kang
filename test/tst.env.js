/*
 * tst.env.js: test environment variable parsing
 */

var mod_assert = require('assert');
var mod_kang = require('../lib/kang');

mod_assert.deepEqual(mod_kang.knMakeSource('example.com'), {
	protocol: 'http',
	host: 'example.com',
	port: 80,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('example:8080'), {
	protocol: 'http',
	host: 'example',
	port: 8080,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('http://example:8080'), {
	protocol: 'http',
	host: 'example',
	port: 8080,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('https://example'), {
	protocol: 'https',
	host: 'example',
	port: 443,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('https://example:8080'), {
	protocol: 'https',
	host: 'example',
	port: 8080,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('http://example:8080/foo'), {
	protocol: 'http',
	host: 'example',
	port: 8080,
	path: '/foo'
});

mod_assert.deepEqual(mod_kang.knMakeSource('https://example:8080/foo'), {
	protocol: 'https',
	host: 'example',
	port: 8080,
	path: '/foo'
});

mod_assert.deepEqual(mod_kang.knMakeSource('example:8080/foo'), {
	protocol: 'http',
	host: 'example',
	port: 8080,
	path: '/foo'
});

mod_assert.deepEqual(mod_kang.knMakeSource('example/bar'), {
	protocol: 'http',
	host: 'example',
	port: 80,
	path: '/bar'
});

mod_assert.throws(function () { mod_kang.knMakeSource(':8080'); },
    /no host specified/);

mod_assert.throws(function () { mod_kang.knMakeSource('/foobar'); },
    /no host specified/);

mod_assert.throws(function () { mod_kang.knMakeSource(':80/foobar'); },
    /no host specified/);

mod_assert.throws(function () { mod_kang.knMakeSource('http://'); },
    /no host specified/);

mod_assert.throws(function () { mod_kang.knMakeSource('http:///bar'); },
    /no host specified/);

mod_assert.throws(function () { mod_kang.knMakeSource('example:foo'); },
    /invalid port/);

mod_assert.deepEqual(mod_kang.knParseSources(''), []);
mod_assert.deepEqual(mod_kang.knParseSources('moe'), [ {
	protocol: 'http',
	host: 'moe',
	port: 80,
	path: '/kang/snapshot'
}]);
mod_assert.deepEqual(mod_kang.knParseSources('moe,apu,ralph:8080/catfood'), [ {
	protocol: 'http',
	host: 'moe',
	port: 80,
	path: '/kang/snapshot'
}, {
	protocol: 'http',
	host: 'apu',
	port: 80,
	path: '/kang/snapshot'
}, {
	protocol: 'http',
	host: 'ralph',
	port: 8080,
	path: '/catfood'
} ]);
