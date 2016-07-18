/**
 * Module dependencies
 */

var Sails = require('sails').Sails;
var asAction = require('../..');


/**
 * [testRoute description]
 * @param  {[type]} label        [description]
 * @param  {[type]} opts         [description]
 * @param  {[type]} testFn [description]
 * @return {[type]}              [description]
 */
module.exports = function testRoute(label, opts, testFn){
  var app = setupLifecycle();
  describe(label, function (){
    this.timeout(5000);

    it('should respond as expected', function (done) {
      return sendRequest(app, opts, function (err, resp, body) {
        return testFn(err, resp, body, done);
      });
    });
  });
};



/**
 * [sendRequest description]
 * @param  {[type]} app            [description]
 * @param  {[type]} opts           [method, path, machine, files, responses]
 * @param  {[type]} testResponseFn [description]
 * @return {[type]}                [description]
 */
function sendRequest(app, opts, testResponseFn){

  // Default to a reasonable method and path to simplify authoring
  // when these things don't actually matter for the test at hand.
  opts.method = opts.method || 'GET';
  opts.path = opts.path || '/';

  app.router.flush((function (){
    var routes = {};
    routes[opts.method + ' ' + opts.path] = asAction({
      machine: opts.machine,
      files: opts.files||[],
      responses: opts.responses||{}
    });
    return routes;
  })());
  // Should now be able to hit route w/ an appropriate request


  app.request(opts.method + ' ' + opts.path, opts.params||{}, testResponseFn);
}







/**
 * before and after lifecycle callbacks for mocha
 * @return {SailsApp}
 */
function setupLifecycle (){

  var app = Sails();
  before(function (done){
    app.load({
      hooks: {
        grunt: false
      },
      log: {
        level: 'silent'
      },
      globals: false
    }, function (err){
      if (err) { return done(err); }
      else { return done(); }
    });
  });

  after(function (done){
    app.lower(function (err){
      if (err) { return done(err); }
      else { return done(); }
    });
  });

  return app;

}
