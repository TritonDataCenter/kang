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

mod_assert.deepEqual(mod_kang.knMakeSource('127.0.0.1'), {
	protocol: 'http',
	host: '127.0.0.1',
	port: 80,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('127.0.0.1/foo'), {
	protocol: 'http',
	host: '127.0.0.1',
	port: 80,
	path: '/foo'
});

mod_assert.deepEqual(mod_kang.knMakeSource('127.0.0.1:8080'), {
	protocol: 'http',
	host: '127.0.0.1',
	port: 8080,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('127.0.0.1:8080/foo'), {
	protocol: 'http',
	host: '127.0.0.1',
	port: 8080,
	path: '/foo'
});

mod_assert.deepEqual(mod_kang.knMakeSource('[::1]'), {
	protocol: 'http',
	host: '::1',
	port: 80,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('https://[::1]'), {
	protocol: 'https',
	host: '::1',
	port: 443,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('[::1]:8080'), {
	protocol: 'http',
	host: '::1',
	port: 8080,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('[fe80::92b8:d0ff:fe4b:c73b]'), {
	protocol: 'http',
	host: 'fe80::92b8:d0ff:fe4b:c73b',
	port: 80,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('[fd00::1]'), {
	protocol: 'http',
	host: 'fd00::1',
	port: 80,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('[fd00::1]/bar'), {
	protocol: 'http',
	host: 'fd00::1',
	port: 80,
	path: '/bar'
});

mod_assert.deepEqual(mod_kang.knMakeSource('[fd00::1]:8080'), {
	protocol: 'http',
	host: 'fd00::1',
	port: 8080,
	path: '/kang/snapshot'
});

mod_assert.deepEqual(mod_kang.knMakeSource('[fd00::1]:8080/baz'), {
	protocol: 'http',
	host: 'fd00::1',
	port: 8080,
	path: '/baz'
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

mod_assert.throws(function () { mod_kang.knMakeSource('example:65536'); },
    /invalid port: 65536 \(must be in range 1-65535\)$/);

mod_assert.throws(function () { mod_kang.knMakeSource('example:0'); },
    /invalid port: 0 \(must be in range 1-65535\)$/);

mod_assert.throws(function () { mod_kang.knMakeSource('example:-1'); },
    /invalid port: invalid number: "-1"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('example:foo'); },
    /invalid port: invalid number: "foo"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('example:123b'); },
    /invalid port: trailing characters after number: "b"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('example:0x1'); },
    /invalid port: trailing characters after number: "x1"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('example:0xa'); },
    /invalid port: trailing characters after number: "xa"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('example:1.2'); },
    /invalid port: trailing characters after number: ".2"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('example:1\t2'); },
    /invalid port: trailing characters after number: "\\t2"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('1.2.3.400'); },
    /bad IPv4 address: "1.2.3.400"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('256.2.3.4'); },
    /bad IPv4 address: "256.2.3.4"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('[::12345]'); },
    /bad IPv6 address: "::12345"$/);

mod_assert.throws(function () { mod_kang.knMakeSource('[:1:]'); },
    /bad IPv6 address: ":1:"$/);

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

mod_assert.deepEqual(
    mod_kang.knParseSources('127.0.0.1/foo,[::1]:8090,localhost:8080/catfood'),
    [ {
	protocol: 'http',
	host: '127.0.0.1',
	port: 80,
	path: '/foo'
}, {
	protocol: 'http',
	host: '::1',
	port: 8090,
	path: '/kang/snapshot'
}, {
	protocol: 'http',
	host: 'localhost',
	port: 8080,
	path: '/catfood'
} ]);
