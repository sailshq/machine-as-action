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
  if (body !== undefined) {
    // NOTE: this is only because '' is interpeted as `undefined` in the streaming logic inside the VRI/`sails.request()`.
    return done(new Error('should have gotten `undefined` as the response body, but instead got: '+util.inspect(body)));
  }
  return done();
});







testRoute('optional inputs should show up as `undefined` when parameter val is not provided', {
  machine: {
    inputs: {
      x: {
        example: 'hi'
      }
    },
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      if (inputs.x !== undefined) return exits.error();
      return exits.success();
    }
  },
  params: {
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  return done();
});










testRoute('when no param val is specified for required input, should respond w/ bad request error', {
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
      return exits.success();
    }
  },
  params: {
  }
}, function (err, resp, body, done){
  if (err) {
    if (err.status !== 400) {
      return done(new Error('Should have responded with a 400 status code (instead got '+err.status+')'));
    }
    return done();
  }
  return done(new Error('Should have responded with a bad request error! Instead got status code 200.'));
});











testRoute('when param val of incorrect type is specified, should respond w/ bad request error', {
  machine: {
    inputs: {
      x: {
        example: 'hi'
      }
    },
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.success();
    }
  },
  params: {
    x: {
      foo: [[4]]
    }
  }
}, function (err, resp, body, done){
  if (err) {
    if (err.status !== 400) {
      return done(new Error('Should have responded with a 400 status code (instead got '+err.status+')'));
    }
    return done();
  }
  return done(new Error('Should have responded with a bad request error! Instead got status code 200.'));
});







testRoute('when param val of incorrect type is specified, should respond w/ bad request error', {
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
      return exits.success();
    }
  },
  params: {
    x: [4, 3]
  }
}, function (err, resp, body, done){
  if (err) {
    console.log(err);
    if (err.status !== 400) {
      return done(new Error('Should have responded with a 400 status code (instead got '+err.status+')'));
    }
    return done();
  }
  return done(new Error('Should have responded with a bad request error! Instead got status code 200.'));
});
