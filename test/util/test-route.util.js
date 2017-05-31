/**
 * Module dependencies
 */

var setupLifecycle = require('./setup-lifecycle.util');
var buildActionAndSendRequest = require('./build-action-and-send-request.util');



/**
 * [testRoute description]
 * @param  {String} label
 * @param  {Dictionary} opts
 *         For the most part, this is a normal machine-as-action definition dictionary,
 *         with normal machine things, plus the special machine-as-action things.
 *         BUT it also recognizes an extra special property: `_testOpts`.
 *         This is a dictionary, with the properties below:
 *         _testOpts.routeAddress    - the route address to bind
 *         _testOpts.method          - runtime request method
 *         _testOpts.path            - runtime request path
 *         _testOpts.params          - runtime request params (i.e. to send in the body or querystring, whichever is apropos)
 *
 * @param  {[type]} testFn [description]
 * @return {[type]}              [description]
 */
module.exports = function testRoute(label, opts, testFn) {
  var app = setupLifecycle();
  describe(label, function() {
    this.timeout(5000);

    it('should respond as expected', function(done) {
      try {
        return buildActionAndSendRequest(app, opts, function(err, resp, body) {
          return testFn(err, resp, body, done);
        });
      } catch (e) {
        return testFn(e, undefined, undefined, done);
      }
    }); //</it>
  }); //</describe>
};
