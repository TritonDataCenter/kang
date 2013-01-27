/*
 * tst.lib.js: test low-level library functions
 */

var mod_assert = require('assert');
var mod_jsprim = require('jsprim');
var mod_kang = require('../lib/kang');
var mod_nutil = require('../lib/nodeutil');

mod_assert.ok(mod_jsprim.startsWith('grampa/simpson', 'grampa'));
mod_assert.ok(mod_jsprim.startsWith('grampa/simpson', 'grampa/'));
mod_assert.ok(mod_jsprim.startsWith('grampa', 'grampa'));
mod_assert.ok(!mod_jsprim.startsWith('grampa', 'grampa/simpson'));
mod_assert.ok(!mod_jsprim.startsWith('abe', 'grampa/simpson'));
mod_assert.ok(!mod_jsprim.startsWith('grampa/simpson', 'abe'));

mod_assert.equal(mod_nutil.chopSlashes('edna'), 'edna');
mod_assert.equal(mod_nutil.chopSlashes('edna/'), 'edna');
mod_assert.equal(mod_nutil.chopSlashes('edna//'), 'edna');
mod_assert.equal(mod_nutil.chopSlashes('/edna//'), '/edna');
mod_assert.equal(mod_nutil.chopSlashes('/edna/krab/'), '/edna/krab');
mod_assert.equal(mod_nutil.chopSlashes('/edna/krab//'), '/edna/krab');
mod_assert.equal(mod_nutil.chopSlashes('/edna/krab///'), '/edna/krab');
