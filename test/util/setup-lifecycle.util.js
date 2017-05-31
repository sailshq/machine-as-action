/**
 * Module dependencies
 */

var Sails = require('sails').Sails;


/**
 * before and after lifecycle callbacks for mocha
 * @return {SailsApp}
 */

module.exports = function setupLifecycle() {

  var app = Sails();
  before(function(done) {
    app.load({
      hooks: {
        grunt: false
      },
      log: {
        level: 'warn'
      },
      globals: false
    }, function(err) {
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  });

  after(function(done) {
    app.lower(function(err) {
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  });

  return app;

};
