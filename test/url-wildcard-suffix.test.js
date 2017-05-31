var assert = require('assert');
var testRoute = require('./util/test-route.util');



testRoute('with urlWildcardSuffix option', {


  //------(these are just for the test utilities)------------//
  _testOpts: {
    routeAddress: 'GET /*',
    method: 'GET',
    path: '/foo/bar',
  },
  //-----------------------</ >------------------------------//


  urlWildcardSuffix: 'star',


  inputs: {

    star: {
      description: 'The wildcard string, the final segment of the incoming request\'s URL.',
      extendedDescription: 'This is the actual, runtime value of the "wildcard variable" ("*") expected by this route\'s URL pattern: `<<COMPILER INJECTS URL HERE>>`.  Note that, unlike with URL _pattern variables_ (e.g. ":foo"), URL wildcard variables can contain slashes ("/").',
      example: 'some-string/like-this/which%20might%20contain/slashes',
      required: true
    }

  },


  exits: {

    success: {
      outputExample: '/blah/blah/blah'
    }

  },


  fn: function(inputs, exits) {
    return exits.success(inputs.star);
  }


}, function(err, resp, body, done) {
  if (err) {
    return done(err);
  }

  try {

    assert.equal(body, 'foo/bar');

  } catch (e) {
    return done(e);
  }

  return done();

});
