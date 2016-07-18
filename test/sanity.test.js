var util = require('util');
var _ = require('lodash');
var testRoute = require('./helpers/test-route.helper');




testRoute('sanity check (ridiculously simplistic usage should work)', {
  machine: {
    inputs: {},
    exits: {},
    fn: function (inputs, exits) {
      return exits.success();
    }
  },
}, function (err, resp, body, done){
  if (err) return done(err);
  return done();
});






testRoute('should be able to access `env.req` and `env.res`', {
  method: 'POST',
  path: '/something',
  machine: {
    inputs: {},
    exits: {},
    fn: function (inputs, exits, env) {
      if (!env.req||!env.res||env.req.method !== 'POST') {
        return exits.error();
      }
      env.res.set('x-test', 'itworked');
      return exits.success();
    }
  },
}, function (err, resp, body, done){
  if (err) return done(err);
  if (resp.headers['x-test'] !== 'itworked') {
    return done(new Error('Machine should have been able to set response header (`x-test`) to "itworked"!'));
  }
  return done();
});




testRoute('if exit def + compatible output example is specified, actual result should be sent as the response body (i.e. responseType==="json")', {
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









// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Note: for simplicity/clarity, and for consistency w/ blueprints in Sails v1.0,
// machine-as-action always uses res.serverError(), and does not negotiate param
// validation errors as bad requests (4xx).  Over time, if it is helpful, we can change
// this behavior to have machine-as-action perform its own RTTC validation and send
// a 400 response in this scenario.  (We could almost also inspect the error code, but
// since it is not unlikely that the code inside the action uses _other_ machines, it
// wouldn't be 100% safe to do that.)
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


// testRoute('when no param val is specified for required input, should respond w/ bad request error', {
//   machine: {
//     inputs: {
//       x: {
//         example: 'hi',
//         required: true
//       }
//     },
//     exits: {
//       success: {
//         example: 'some string'
//       }
//     },
//     fn: function (inputs, exits) {
//       return exits.success();
//     }
//   },
//   params: {
//   }
// }, function (err, resp, body, done){
//   if (err) {
//     if (err.status !== 400) {
//       return done(new Error('Should have responded with a 400 status code (instead got '+err.status+')'));
//     }
//     return done();
//   }
//   return done(new Error('Should have responded with a bad request error! Instead got status code 200.'));
// });


// testRoute('when param val of incorrect type is specified, should respond w/ bad request error', {
//   machine: {
//     inputs: {
//       x: {
//         example: 'hi'
//       }
//     },
//     exits: {
//       success: {
//         example: 'some string'
//       }
//     },
//     fn: function (inputs, exits) {
//       return exits.success();
//     }
//   },
//   params: {
//     x: {
//       foo: [[4]]
//     }
//   }
// }, function (err, resp, body, done){
//   if (err) {
//     if (err.status !== 400) {
//       return done(new Error('Should have responded with a 400 status code (instead got '+err.status+')'));
//     }
//     return done();
//   }
//   return done(new Error('Should have responded with a bad request error! Instead got status code 200.'));
// });


// testRoute('when param val of incorrect type is specified, should respond w/ bad request error', {
//   machine: {
//     inputs: {
//       x: {
//         example: 'hi',
//         required: true
//       }
//     },
//     exits: {
//       success: {
//         example: 'some string'
//       }
//     },
//     fn: function (inputs, exits) {
//       return exits.success();
//     }
//   },
//   params: {
//     x: [4, 3]
//   }
// }, function (err, resp, body, done){
//   if (err) {
//     if (err.status !== 400) {
//       return done(new Error('Should have responded with a 400 status code (instead got '+err.status+')'));
//     }
//     return done();
//   }
//   return done(new Error('Should have responded with a bad request error! Instead got status code 200.'));
// });











testRoute('customizing success exit to use a special status code in the response should work', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.success();
    }
  },
  responses: {
    success: {
      responseType: '',
      statusCode: 201
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
      responseType: 'redirect',
      example: 'http://whatever.com',
      statusCode: 301
    }
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (resp.statusCode !== 301) {
    return done(new Error('Should have responded with a 301 status code (instead got '+resp.statusCode+')'));
  }
  if (resp.headers.location !== 'http://google.com') {
    return done(new Error('Should have sent the appropriate "Location" response header'));
  }
  return done();
});



testRoute('redirecting should work, even without specifying a status code or output example', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.success('/foo/bar');
    }
  },
  responses: {
    success: {
      responseType: 'redirect'
    }
  }
}, function (err, resp, body, done){
  if (err) { return done(err); }
  if (resp.statusCode !== 302) {
    return done(new Error('Should have responded with a 302 status code (instead got '+resp.statusCode+')'));
  }
  if (resp.headers.location !== '/foo/bar') {
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
      return exits.success('some output value');
    }
  },
  responses: {
    success: {
      responseType: ''
    }
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (resp.statusCode !== 200) {
    return done(new Error('Should have responded with a 200 status code (instead got '+resp.statusCode+')'));
  }
  if (body !== 'some output value') {
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
      return exits.whatever('some output value');
    }
  },
  responses: {
    success: {
      responseType: ''
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






testRoute('exits other than success can have their status codes overriden too', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      },
      whatever: {}
    },
    fn: function (inputs, exits) {
      return exits.whatever('some output value');
    }
  },
  responses: {
    success: {
      responseType: ''
    },
    whatever: {
      responseType: '',
      statusCode: 204
    }
  }
}, function (err, resp, body, done){
  if (err) {
    console.log(err.status);
    return done(err);
  }
  if (resp.statusCode !== 204) {
    return done(new Error('Should have responded with status code 204 (but instead got status code '+resp.statusCode+')'));
  }
  return done();
});











testRoute('ceteris paribus, overriding status code should change response type inference for non-default exit (e.g. status==203 sets unspecified response type to `status` or `json`)', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      },
      whatever: {}
    },
    fn: function (inputs, exits) {
      return exits.whatever('some output value');
    }
  },
  responses: {
    success: {
      responseType: ''
    },
    whatever: {
      statusCode: 204
    }
  }
}, function (err, resp, body, done){
  if (err) {
    return done(new Error('Should have responded with status code 204-- instead got '+err.status));
  }
  if (resp.statusCode !== 204) {
    return done(new Error('Should have responded with status code 204 (but instead got status code '+resp.statusCode+')'));
  }
  return done();
});







testRoute('ceteris paribus, overriding status code should change response type inference for default exit (i.e. status==503 sets unspecified response type to `error`)', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      },
      whatever: {}
    },
    fn: function (inputs, exits) {
      return exits.success('some output value');
    }
  },
  responses: {
    success: {
      statusCode: 503
    },
    whatever: {}
  }
}, function (err, resp, body, done){
  if (err) {
    if (err.status !== 503) {
      return done(new Error('Should have responded with status code 503-- instead got '+err.status));
    }
    return done();
  }
  return done(new Error('Should have responded with status code 503 (but instead got status code '+resp.statusCode+')'));
});






testRoute('`redirect` with custom status code', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      },
      whatever: {}
    },
    fn: function (inputs, exits) {
      return exits.success('http://google.com');
    }
  },
  responses: {
    success: {
      statusCode: 301,
      responseType: 'redirect'
    },
    whatever: {}
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (resp.statusCode !== 301) {
    return done(new Error('Should have responded with a 301 status code (instead got '+resp.statusCode+')'));
  }
  if (resp.headers.location !== 'http://google.com') {
    return done(new Error('Should have sent the appropriate "Location" response header'));
  }
  return done();
});





testRoute('`redirect` with custom status code', {
  machine: {
    inputs: {},
    exits: {
      success: {
        example: 'some string'
      },
      whatever: {
        example: 'some string'
      }
    },
    fn: function (inputs, exits) {
      return exits.whatever('http://google.com');
    }
  },
  responses: {
    success: {
    },
    whatever: {
      statusCode: 301,
      responseType: 'redirect'
    }
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  if (resp.statusCode !== 301) {
    return done(new Error('Should have responded with a 301 status code (instead got '+resp.statusCode+')'));
  }
  if (resp.headers.location !== 'http://google.com') {
    return done(new Error('Should have sent the appropriate "Location" response header'));
  }
  return done();
});




//
// Not implemented in core `sails.request()` yet
//

// testRoute('serving a `view` should work', {
//   machine: {
//     inputs: {},
//     exits: {
//       success: {
//         example: {}
//       },
//       whatever: {}
//     },
//     fn: function (inputs, exits) {
//       return exits.success();
//     }
//   },
//   responses: {
//     success: {
//       responseType: 'view',
//       view: 'homepage'
//     },
//     whatever: {}
//   }
// }, function (err, resp, body, done){
//   if (err) return done(err);
//   return done();
// });


// testRoute('`view` with custom status code', {
//   machine: {
//     inputs: {},
//     exits: {
//       success: {
//         example: {}
//       },
//       whatever: {}
//     },
//     fn: function (inputs, exits) {
//       return exits.success();
//     }
//   },
//   responses: {
//     success: {
//       statusCode: 205,
//       responseType: 'view',
//       view: 'homepage'
//     },
//     whatever: {}
//   }
// }, function (err, resp, body, done){
//   if (err) return done(err);
//   if (resp.statusCode !== 205) {
//     return done(new Error('Should have responded with a 205 status code (instead got '+resp.statusCode+')'));
//   }
//   return done();
// });




//
// Cannot test `files` here w/ `sails.request()`
//

