/*
 * tst.lib.js: test low-level library functions
 */

var mod_assert = require('assert');
var mod_kang = require('../lib/kang');

mod_assert.ok(mod_kang.knStartsWith('grampa/simpson', 'grampa'));
mod_assert.ok(mod_kang.knStartsWith('grampa/simpson', 'grampa/'));
mod_assert.ok(mod_kang.knStartsWith('grampa', 'grampa'));
mod_assert.ok(!mod_kang.knStartsWith('grampa', 'grampa/simpson'));
mod_assert.ok(!mod_kang.knStartsWith('abe', 'grampa/simpson'));
mod_assert.ok(!mod_kang.knStartsWith('grampa/simpson', 'abe'));

mod_assert.equal(mod_kang.knChopSlashes('edna'), 'edna');
mod_assert.equal(mod_kang.knChopSlashes('edna/'), 'edna');
mod_assert.equal(mod_kang.knChopSlashes('edna//'), 'edna');
mod_assert.equal(mod_kang.knChopSlashes('/edna//'), '/edna');
mod_assert.equal(mod_kang.knChopSlashes('/edna/krab/'), '/edna/krab');
mod_assert.equal(mod_kang.knChopSlashes('/edna/krab//'), '/edna/krab');
mod_assert.equal(mod_kang.knChopSlashes('/edna/krab///'), '/edna/krab');
