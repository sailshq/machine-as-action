var util = require('util');
var _ = require('lodash');
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
    if (err.status !== 400) {
      return done(new Error('Should have responded with a 400 status code (instead got '+err.status+')'));
    }
    return done();
  }
  return done(new Error('Should have responded with a bad request error! Instead got status code 200.'));
});











testRoute('customizing success exit to use a special status code in the response should work', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.success('STUFF AND THINGS');
    }
  },
  responses: {
    success: {
      responseType: 'status',
      status: 201
    }
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (resp.statusCode !== 201) {
    return done(new Error('Should have responded with a 201 status code (instead got '+resp.statusCode+')'));
  }
  if (!_.isUndefined(body)) {
    return done(new Error('Should not have sent a response body (but got '+body+')'));
  }
  return done();
});






testRoute('customizing success exit to do a redirect should work', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.success('http://google.com');
    }
  },
  responses: {
    success: {
      responseType: 'redirect'
    }
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (resp.statusCode !== 302) {
    return done(new Error('Should have responded with a 302 status code (instead got '+resp.statusCode+')'));
  }
  if (resp.headers.location !== 'http://google.com') {
    return done(new Error('Should have sent the appropriate "Location" response header'));
  }
  return done();
});





testRoute('customizing success exit to do JSON should work', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.success('http://google.com');
    }
  },
  responses: {
    success: {
      responseType: 'json'
    }
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (resp.statusCode !== 200) {
    return done(new Error('Should have responded with a 200 status code (instead got '+resp.statusCode+')'));
  }
  if (body !== 'http://google.com') {
    return done(new Error('Should have sent the appropriate response body'));
  }
  return done();
});




testRoute('exits other than success should default to status code 500', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      },
      whatever: {}
    },
    fn: function (inputs, exits) {
      return exits.whatever('http://google.com');
    }
  },
  responses: {
    success: {
      responseType: 'json'
    }
  }
}, function (err, resp, body, done){
  if (err) {
    if (err.status !== 500) {
      return done(new Error('Should have responded with status code 500 (but instead got status code '+err.status+')'));
    }
    return done();
  }
  return done(new Error('Should have responded with status code 500 (but instead got status code 200)'));
});
