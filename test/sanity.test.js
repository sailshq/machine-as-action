var util = require('util');
var testRoute = require('./helpers/test-route.helper');




testRoute('sanity check', {
  machine: {
    inputs: {},
    exits: {},
    fn: function (inputs, exits) {
      return exits.success();
    }
  },
  // files: [],
  // responses: {}
  // params: {}
  // method: 'GET'
  // path: '/'
}, function (err, resp, body, done){
  if (err) return done(err);
  return done();
});



testRoute('if exit def + compatible output example is specified, result should be sent as the response body', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.success('hello world!');
    }
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (body !== 'hello world!') return done(new Error('should have gotten "hello world!" as the response body, but instead got: '+util.inspect(body)));
  return done();
});


testRoute('if input def + compatible input examples are specified, parameters should be provided as inputs', {
  machine: {
    inputs: {
      x: {
        example: 'hi',
        required: true
      }
    },
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.success(inputs.x);
    }
  },
  params: {
    x: 'hello world!'
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (body !== 'hello world!') return done(new Error('should have gotten "hello world!" as the response body, but instead got: '+util.inspect(body)));
  return done();
});




testRoute('ignore extra parameters', {
  machine: {
    inputs: {
      x: {
        example: 'hi',
        required: true
      }
    },
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.success(inputs.y);
    }
  },
  params: {
    x: 'some value for x',
    y: 'some value for y'
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (body !== '') return done(new Error('should have gotten "" as the response body, but instead got: '+util.inspect(body)));
  return done();
});
