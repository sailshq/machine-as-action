/**
 * Module dependencies
 */

var setupLifecycle = require('./setup-lifecycle.helper');
var buildActionAndSendRequest = require('./build-action-and-send-request.helper');



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
      try {
        return buildActionAndSendRequest(app, opts, function (err, resp, body) {
          return testFn(err, resp, body, done);
        });
      } catch (e) {
        return testFn(e, undefined, undefined, done);
      }
    });//</it>
  });//</describe>
};


