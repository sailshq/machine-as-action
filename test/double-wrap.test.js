var assert = require('assert');
var asAction = require('../');
var testRoute = require('./helpers/test-route.helper');



testRoute('double-wrapping should fail', {
  machine: asAction({
    inputs: {},
    exits: {},
    fn: function (inputs, exits) {
      return exits.success();
    }
  }),
}, function (err, resp, body, done){
  if (err) {
    assert.equal(err.code, 'E_DOUBLE_WRAP');
    return done();
  }
  return done(new Error('Double-wrapped machine-as-action should have failed!'));
});



