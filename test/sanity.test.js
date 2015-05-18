var testRoute = require('./helpers/test-route.helper');




testRoute('sanity test', {
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


testRoute('sanity test w/ params', {
  machine: {
    inputs: {
      x: {
        example: 'hi',
        required: true
      }
    },
    exits: {},
    fn: function (inputs, exits) {
      return exits.success(inputs.x);
    }
  },
  params: {
    x: 'hello world!'
  }
}, function (err, resp, body, done){
  if (err) return done(err);
  return done();
});
