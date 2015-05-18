var testRoute = require('./helpers/test-route.helper');




testRoute('sanity test', {
  method: 'get',
  path: '/',
  machine: {
    inputs: {},
    exits: {},
    fn: function (inputs, exits) {
      return exits.success();
    }
  },
  // files: [],
  // responses: {}
}, function (err, resp, body, done){
  if (err) return done(err);
  return done();
});
