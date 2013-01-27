/*
 * tst.snapshot_merge.js: test basic snapshot behavior and merging
 */

var mod_assert = require('assert');
var mod_kang = require('../lib/kang');

var snapshot_svconly = {
	'source': mod_kang.knMakeSource('localhost'),
	'service': {
		'name': 'ca',
		'component': 'configsvc',
		'ident': 'headnode',
		'version': '6.5.3'
	}
};

var snapshot_complete = {
	'source': mod_kang.knMakeSource('localhost'),
	'service': {
		'name': 'ca',
		'component': 'configsvc',
		'ident': 'headnode',
		'version': '6.5.3'
	},
	'stats': {
		'uptime': 1523,
		'nerrors': 12
	},
	'types': [ 'instr', 'instn' ],
	'instr': {
		'cn01': {
			'last_contact': '2012-02-10T23:41:20.095Z',
			'present': false
		},
		'cn02': {
			'last_contact': '2012-02-09T23:41:20.095Z',
			'present': true
		},
		'cn03': {
			'last_contact': '2012-02-09T22:40:20.095Z',
			'present': true,
			'known_instns': [ 'instn:007' ]
		}
	},
	'instn': {
		'005': {
			'metric': 'node.httpc_ops',
			'granularity': 5,
			'instrs': {}
		},
		'007': {
			'metric': 'node.httpd_ops',
			'granularity': 10,
			'instrs': {
				'instr:cn03': { enabled: true },
				'instr:cn01': { enabled: false }
			}
		}
	}
};

var snapshot_overlap = {
	'source': mod_kang.knMakeSource('localhost'),
	'service': {
		'name': 'ca',
		'component': 'caaggsvc',
		'ident': 'auto10',
		'version': '6.5.3'
	},
	'stats': {
		'uptime': 1635,
		'nerrors': 8
	},
	'types': [ 'instn' ],
	'instn': {
		'005': { 'data-points': 12 }
	}
};

var result, entry;

/* no snapshots */
result = mod_kang.knMergeSnapshots([]);
mod_assert.deepEqual([], result.types());
mod_assert.deepEqual([], result.list('foo'));
mod_assert.deepEqual([], result.lookup('foo', 'bar'));
mod_assert.deepEqual(undefined, result.lookupFirst('foo', 'bar'));

/* simple snapshot */
result = mod_kang.knMergeSnapshots([ snapshot_svconly ]);
mod_assert.deepEqual([ 'service' ], result.types());
mod_assert.deepEqual([ 'ca.configsvc.headnode' ], result.list('service'));
mod_assert.deepEqual([ {
    'name': 'ca',
    'component': 'configsvc',
    'ident': 'headnode',
    'version': '6.5.3',
    'service': 'ca.configsvc.headnode',
    'source': 'http://localhost:80/kang/snapshot'
}], result.lookup('service', 'ca.configsvc.headnode'));

mod_assert.deepEqual({
    'name': 'ca',
    'component': 'configsvc',
    'ident': 'headnode',
    'version': '6.5.3',
    'service': 'ca.configsvc.headnode',
    'source': 'http://localhost:80/kang/snapshot'
}, result.lookupFirst('service', 'ca.configsvc.headnode'));

/* snapshot with objects and links */
result = mod_kang.knMergeSnapshots([ snapshot_complete ]);
mod_assert.deepEqual([ 'service', 'stats', 'instr', 'instn' ], result.types());
mod_assert.deepEqual([ 'ca.configsvc.headnode' ], result.list('service'));
mod_assert.deepEqual([ 'ca.configsvc.headnode' ], result.list('stats'));
mod_assert.deepEqual([ 'cn01', 'cn02', 'cn03' ], result.list('instr'));
mod_assert.deepEqual([ '005', '007' ], result.list('instn'));

entry = result.lookup('service', 'ca.configsvc.headnode');

mod_assert.deepEqual([ {
    'name': 'ca',
    'component': 'configsvc',
    'ident': 'headnode',
    'version': '6.5.3',
    'service': 'ca.configsvc.headnode',
    'source': 'http://localhost:80/kang/snapshot'
}], entry);

mod_assert.deepEqual([], result.links(entry));
mod_assert.deepEqual([], result.links(entry[0]));

mod_assert.deepEqual({
    'stats': 'ca.configsvc.headnode',
    'uptime': 1523,
    'nerrors': 12
}, result.lookupFirst('stats', 'ca.configsvc.headnode'));

mod_assert.deepEqual({
    'name': 'ca',
    'component': 'configsvc',
    'ident': 'headnode',
    'version': '6.5.3',
    'service': 'ca.configsvc.headnode',
    'source': 'http://localhost:80/kang/snapshot'
}, result.lookupFirst('service', 'ca.configsvc.headnode'));

entry = result.lookupFirst('instr', 'cn01');

mod_assert.deepEqual({
	'last_contact': '2012-02-10T23:41:20.095Z',
	'present': false,
	'instr': 'cn01'
}, entry);

mod_assert.deepEqual([], result.links(entry));

entry = result.lookupFirst('instn', '005');
mod_assert.deepEqual([], result.links(entry));

entry = result.lookupFirst('instn', '007');
mod_assert.deepEqual([ 'instr:cn03', 'instr:cn01' ], result.links(entry));

entry = result.lookupFirst('instr', 'cn01');
mod_assert.deepEqual([], result.links(entry));

entry = result.lookupFirst('instr', 'cn03');
mod_assert.deepEqual([ 'instn:007' ], result.links(entry));

/* second snapshot with overlapping objects */
result = mod_kang.knMergeSnapshots([ snapshot_complete, snapshot_overlap ]);
