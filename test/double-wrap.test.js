var assert = require('assert');
var asAction = require('../');
var testRoute = require('./util/test-route.util');



testRoute('double-wrapping should fail when passing in an already-converted-machine-which-is-now-an-action as `machine`', {

  machine: asAction({
    inputs: {},
    exits: {},
    fn: function (inputs, exits) {
      return exits.success();
    }
  })

}, function (err, resp, body, done){
  if (err) {
    assert.equal(err.code, 'E_DOUBLE_WRAP');
    return done();
  }
  return done(new Error('Double-wrapped machine-as-action should have failed!'));
});






testRoute('double-wrapping should fail when passing in an already-converted-machine-which-is-now-an-action at the top level', asAction({
  inputs: {},
  exits: {},
  fn: function (inputs, exits) {
    return exits.success();
  }
}), function (err, resp, body, done){
  if (err) {
    assert.equal(err.code, 'E_DOUBLE_WRAP');
    return done();
  }
  return done(new Error('Double-wrapped machine-as-action should have failed!'));
});
