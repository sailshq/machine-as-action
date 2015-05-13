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
 * negotiates exits to the appropriate response method (e.g. res.negotiate)
 * and passes in all of the request parameters as inputs, as well as a few
 * other useful env variables including:
 *  • req
 *  • res
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

  return function _requestHandler(req, res) {

    if (!req.allParams) {
      throw new Error('`machine-as-action` requires `req.allParams()` to exist (i.e. a Sails.js app with the request hook enabled)');
    }
    if (!res.negotiate) {
      throw new Error('`machine-as-action` requires `res.negotiate()` to exist (i.e. a Sails.js app with the responses hook enabled)');
    }
    if (!res.json) {
      throw new Error('`machine-as-action` requires `res.json()` to exist (i.e. a Sails.js or Express app)');
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

    // Build input configuration for machine using request parameters
    var inputConfiguration = _.extend({}, req.allParams());

    // Handle `files` option (to provide access to upstreams)
    if (_.isArray(opts.files)) {
      if (!req.file) {
        throw new Error('In order to use the `files` option, `machine-as-action` requires `req.file()` to exist (i.e. a Sails.js, Express, or Hapi app using Skipper)');
      }
      _.each(opts.files, function (fileParamName){
        inputConfiguration[fileParamName] = req.file(fileParamName);
      });
    }

    var liveMachine = wetMachine.configure(inputConfiguration);
    // Provide `env.req` and `env.res`
    liveMachine.setEnvironment({
      req: req,
      res: res
    });
    // Now run the machine, proxying exits to the response.
    return liveMachine.exec({
      error: function (err){
        return res.negotiate(err);
      },
      success: function (result){

        // TODO: allow specifying additional response mappings/metadata via `opts` (e.g. content type)

        // TODO: Encode exit name as a response header (involves breaking this up into each of the exits specified by the machine definition)

        // TODO ...be smart about streams here...

        if (_.isUndefined(result)) {
          return res.send(200);
        }
        return res.json(result);
      }
    });
  };
};
