/**
 * Module dependencies
 */

var _ = require('lodash');
var Machine = require('machine');


/**
 * machine-as-action
 *
 * Build a conventional controller action (i.e. route handling function)
 * from a machine definition.  This wraps the machine in a function which
 * negotiates exits to the appropriate response method (e.g. res.serverError)
 * and passes in all of the request parameters as inputs, as well as a few
 * other useful scope variables including:
 *  • req
 *  • res
 *  • sails (if it exists)
 *
 * @param  {Object} machineDef
 * @return {Function}
 */

module.exports = function machineAsAction(opts) {

  opts = opts||{};

  // Use either `opts` or `opts.machine` as the machine definition
  var machineDef;
  if (!opts.machine) {
    machineDef = opts;
  }
  else {
    machineDef = opts.machine;
  }

  // Build machine, applying defaults
  var wetMachine = Machine.build(_.extend({
    identity: machineDef.friendlyName||'anonymous-action',
    inputs: {},
    exits: {
      success: {
        description: 'Done.'
      },
      error: {
        description: 'Unexpected error occurred.'
      }
    },
    fn: function (inputs, exits){
      exits.error(new Error('Not implemented yet!'));
    }
  },machineDef||{}));


  return function _requestHandler(req, res, next) {

    if (!req.allParams) {
      throw new Error('Currently, `machine-as-action` requires `req.allParams()` to exist (i.e. a Sails.js app with the request hook enabled)');
    }
    if (!res.negotiate) {
      throw new Error('Currently, `machine-as-action` requires `res.negotiate()` to exist (i.e. a Sails.js app with the responses hook enabled)');
    }
    if (!res.json) {
      throw new Error('Currently, `machine-as-action` requires `res.json()` to exist (i.e. a Sails.js or Express app)');
    }

    // Configure inputs using request parameters
    var liveMachine = wetMachine(req.allParams());
    // Provide `env.req` and `env.res`
    liveMachine.setEnvironment({
      req: req,
      res: res
    });
    // Now run the machine, proxying exits to the response.
    liveMachine.exec({
      error: function (err){
        return res.negotiate(err);
      },
      success: function (result){
        // TODO: handle other types of result data
        return res.json(result);
      }
    });
  };
};
