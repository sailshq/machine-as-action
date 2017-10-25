/**
 * Module dependencies
 */

var asAction = require('../..');



/**
 * [buildActionAndSendRequest description]
 * @param  {SailsApp} app
 * @param  {Dictionary?} opts
 * @param  {Function} testResponseFn
 */
module.exports = function buildActionAndSendRequest(app, opts, testResponseFn) {

  // Default to reasonable test options to simplify authoring
  // when these things don't actually matter for the test at hand.
  opts._testOpts = opts._testOpts || {

    // The route address to bind.
    routeAddress: 'GET /',

    // Request options for the sample request that will be sent.
    method: 'GET',
    path: '/',
    params: {}
  };

  // Freak out if `_testOpts` was passed in, but `routeAddress`, `method`, or `path` are unspecified.
  if (!opts._testOpts.routeAddress) {
    return testResponseFn(new Error('Bad test: If specifying `_testOpts`, then `_testOpts.routeAddress` must be specified.'));
  }
  if (!opts._testOpts.method) {
    return testResponseFn(new Error('Bad test: If specifying `_testOpts`, then `_testOpts.method` must be specified.'));
  }
  if (!opts._testOpts.path) {
    return testResponseFn(new Error('Bad test: If specifying `_testOpts`, then `_testOpts.path` must be specified.'));
  }

  // If unspecified, use `{}`.
  if (!opts._testOpts.params) {
    opts._testOpts.params = {};
  }

  // Dump out the router and configure the new route.
  var newRoutesMapping = {};
  newRoutesMapping[opts._testOpts.routeAddress] = {
    fn: asAction(opts),
    skipAssets: false
  };
  app.router.flush(newRoutesMapping);

  // ¬ Should now be able to hit route w/ an appropriate request.
  app.request(opts._testOpts.method + ' ' + opts._testOpts.path, opts._testOpts.params, function(err, clientRes, body) {
    if (err) {
      return testResponseFn(err);
    }

    return testResponseFn(undefined, clientRes, body);

  });

};
