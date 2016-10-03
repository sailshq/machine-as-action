/**
 * Module dependencies
 */

var asAction = require('../..');



/**
 * [buildActionAndSendRequest description]
 * @param  {[type]} app            [description]
 * @param  {[type]} opts           [method, path, machine, files, responses]
 * @param  {[type]} testResponseFn [description]
 * @return {[type]}                [description]
 */
module.exports = function buildActionAndSendRequest(app, opts, testResponseFn){

  // Default to a reasonable method and path to simplify authoring
  // when these things don't actually matter for the test at hand.
  opts.method = opts.method || 'GET';
  opts.path = opts.path || '/';

  app.router.flush((function (){
    var routes = {};
    // routes[opts.method + ' ' + opts.path] = asAction({
    //   machine: opts.machine,
    //   files: opts.files||[],
    //   responses: opts.responses||{}
    // });
    routes[opts.method + ' ' + opts.path] = asAction(opts);
    return routes;
  })());
  // Should now be able to hit route w/ an appropriate request


  app.request(opts.method + ' ' + opts.path, opts.params||{}, function (err, clientRes, body){
    if (err) { return testResponseFn(err); }
    return testResponseFn(null, clientRes, body);
  });
};
