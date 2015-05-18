/**
 * Module dependencies
 */

var util = require('util');
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


  // Build machine by extending a default def with the actual provided def
  var wetMachine = Machine.build(_.extend({
    identity: machineDef.friendlyName||'anonymous-action',
    inputs: {},
    exits: {},
    fn: function (inputs, exits){
      exits.error(new Error('Not implemented yet!'));
    }
  },machineDef||{}));

  // Allow specifying additional response mappings/metadata via `opts`
  // (e.g. status code, content type, etc) But also normalize this response
  // metadata and provide reasonable defaults so that we don't have to check
  // it at again and again at runtime with each incoming request.
  var responses = normalizeResMeta(opts.responses || {}, wetMachine.exits);



  return function _requestHandler(req, res) {

    // Vanilla Express app requirements
    if (!res.json) {
      throw new Error('`machine-as-action` requires `res.json()` to exist (i.e. a Sails.js or Express app)');
    }
    if (!res.redirect) {
      throw new Error('`machine-as-action` requires `res.redirect()` to exist (i.e. a Sails.js or Express app)');
    }
    if (!res.send) {
      throw new Error('`machine-as-action` requires `res.send()` to exist (i.e. a Sails.js or Express app)');
    }

    // Sails.js app requirements
    if (!req.allParams) {
      throw new Error('`machine-as-action` requires `req.allParams()` to exist (i.e. a Sails.js app with the request hook enabled)');
    }
    if (!res.negotiate) {
      throw new Error('`machine-as-action` requires `res.negotiate()` to exist (i.e. a Sails.js app with the responses hook enabled)');
    }
    if (!res.view) {
      throw new Error('`machine-as-action` requires `res.view()` to exist (i.e. a Sails.js app with the views hook enabled)');
    }

    // Build input configuration for machine using request parameters
    var inputConfiguration = _.reduce(wetMachine.inputs, function (memo, inputDef, inputName) {
      var paramVal = req.param(inputName);
      if (!_.isUndefined(paramVal)) {
        memo[inputName] = paramVal;
      }
      return memo;
    }, {});

    // Handle `files` option (to provide access to upstreams)
    if (_.isArray(opts.files)) {
      if (!req.file) {
        throw new Error('In order to use the `files` option, `machine-as-action` requires `req.file()` to exist (i.e. a Sails.js, Express, or Hapi app using Skipper)');
      }
      _.each(opts.files, function (fileParamName){
        inputConfiguration[fileParamName] = req.file(fileParamName);
      });
    }

    // Configure runtime parameter values as inputs
    var liveMachine = wetMachine.configure(inputConfiguration);

    // Provide `env.req` and `env.res`
    liveMachine.setEnvironment({
      req: req,
      res: res
    });

    // Now build up some exit callbacks...
    var callbacks = {};
    _.each(_.keys(machineDef.exits), function builtExitCallback(exitName){

      callbacks[exitName] = function respondApropos(output){

        // Encode exit name as a response header (involves breaking this up into each of the exits specified by the machine definition)
        res.set('X-Exit', exitName);

        switch (responses[exitName].responseType) {
          case 'error':
            // If there is no output, build an error message explaining what happened.
            return res.negotiate(!_.isUndefined(output) ? output : new Error(util.format('Action for route "%s %s" encountered an error, triggering its "%s" exit. No additional error data was provided.', req.method, req.path, exitName) ));
          case 'status':
            return res.send(responses[exitName].statusCode);
          case 'json':
            return res.json(responses[exitName].statusCode, output);
          case 'redirect':
            return res.redirect(responses[exitName].statusCode, output);
          case 'view':
            res.statusCode = responses[exitName].statusCode;
            return res.view(responses[exitName].viewPath, output);
          default:
            return res.negotiate(new Error('Encountered unexpected error in `machine-as-action`: "unrecognized response type".  Please report this issue at `https://github.com/treelinehq/machine-as-action/issues`'));
        }
      };
    });

    // Then attach them and `.exec()` the machine.
    return liveMachine.exec(callbacks);

  };
};




/**
 * Normalize response metadata.
 *
 * @param  {Object} configuredResponses
 * @param  {Object} exits
 * @return {Object}      [normalized response metadata for each exit]
 */
function normalizeResMeta (configuredResponses, exits){

  // Note that we extend success and error exits here so that they will always exist
  // when this custom response metadata is being built. This only runs once when initially
  // building the action.
  exits = _.extend({
    success: {
      description: 'Done.'
    },
    error: {
      description: 'Unexpected error occurred.'
    }
  }, exits);

  return _.reduce(exits, function (memo, exitDef, exitName) {
    var resMeta = {};

    // If response metadata was explicitly defined, use it.
    // (also validate each property on the way in to ensure it is valid)
    if ( _.isObject(configuredResponses[exitName]) ){
      // Response type (`responseType`)
      if (!_.isUndefined(configuredResponses[exitName].responseType)) {
        resMeta.responseType = configuredResponses[exitName].responseType;
        if (!_.contains(['error', 'status', 'json', 'redirect', 'view'], resMeta.responseType)) {
          throw new Error(util.format('`machine-as-action` doesn\'t know how to handle the response type ("%s") specified for exit "%s".', resMeta.responseType, exitName));
        }
      }
      // Status code (`status`)
      if (!_.isUndefined(configuredResponses[exitName].status)) {
        resMeta.statusCode = +configuredResponses[exitName].status;
        if (_.isNaN(resMeta.statusCode) || resMeta.statusCode < 100 || resMeta.statusCode > 599) {
          throw new Error(util.format('`machine-as-action` doesn\'t know how to handle the status code ("%s") specified for exit "%s".', resMeta.statusCode, exitName));
        }
      }
      // View path (`view`)
      if (!_.isUndefined(configuredResponses[exitName].view)) {
        resMeta.viewPath = configuredResponses[exitName].view;
        if (!_.isString(resMeta.viewPath)) {
          throw new Error(util.format('`machine-as-action` doesn\'t know how to handle the view ("%s") specified for exit "%s".', resMeta.viewPath, exitName));
        }
      }
      // Should not allow explicit/hard-coded output data override here-
      // instead just send that hard-coded data out of the machine exit.
    }


    // Then set any remaining unspecified stuff to reasonable defaults.
    // (note that this makes decisions about how to respond based on the
    //  static exit definition, not the runtime output value.)


    // If `status` is explicitly set, but `responseType` is not, default it to either `status` or `json`.
    // (See TODO below for more info)
    if (!resMeta.responseType && resMeta.statusCode) {
      resMeta.responseType = (_.isUndefined(exitDef.example)) ? 'status' : 'json';
      if (exitDef.example === '~') {
        // TODO ...be smart about streams here...
        throw new Error('Stream type (`~`) is not yet supported!');
      }
    }


    //  If this is the success exit, use the exit example to determine whether
    //  to send back JSON data or just a status code.
    if (exitName === 'success') {
      // That is, unless an explicitly-set status code tells us otherwise
      // if (!resMeta.responseType && resMeta.statusCode >= 400) {
        // TODO: set response type to `error`
        // (right now, can't do this, because res.negotiate() will cause the
        //  status code to ALWAYS be set to 500-- which defeats the purpose.
        //  Once that is adjusted in Sails core and the relevant generators,
        //  this can be uncommented.  For now, if `status` is set, this is no
        //  longer responseType=error.  And maybe that's for the best anyway.)
        // resMeta.responseType = 'error';
      // }
      if (!resMeta.responseType) {
        resMeta.responseType = (_.isUndefined(exitDef.example)) ? 'status' : 'json';
        if (exitDef.example === '~') {
          // TODO ...be smart about streams here...
          throw new Error('Stream type (`~`) is not yet supported!');
        }
      }
    }
    // If this is not the success exit, and there's no configuration otherwise, we'll assume
    // this is some kind of error.
    else {
      // That is, unless an explicitly-set status code tells us otherwise
      // (...same deal as above here...)
      // if (!resMeta.responseType && resMeta.statusCode < 400) {
      //   resMeta.responseType = (_.isUndefined(exitDef.example)) ? 'status' : 'json';
      //   if (exitDef.example === '~') {
      //     // TODO ...be smart about streams here...
      //     throw new Error('Stream type (`~`) is not yet supported!');
      //   }
      // }
      // else {
        resMeta.responseType = resMeta.responseType || 'error';
      // }
    }

    // If status code was not explicitly specified, infer an appropriate code based on the response type.
    // It'll either be `302` (redirect), `500` (error), or `200` (for everything else)
    if (resMeta.responseType === 'redirect') {
      resMeta.statusCode = resMeta.statusCode || 302;
    }
    else if (resMeta.responseType === 'error') {
      resMeta.statusCode = resMeta.statusCode || 500;
    }
    else {
      resMeta.statusCode = resMeta.statusCode || 200;
    }

    // Ensure response type is compatible with exit definition
    if (resMeta.responseType === 'redirect') {
      if (!_.isString(exitDef.example)) {
        throw new Error(util.format('`machine-as-action` cannot configure exit "%s" to redirect.  The redirect URL is based on the return value from the exit, so the exit\'s `example` must be a string.  But instead, it\'s: ', exitName,util.inspect(exitDef.example, false, null)));
      }
    }
    else if (resMeta.responseType === 'view') {
      if (!_.isPlainObject(exitDef.example)) {
        throw new Error(util.format('`machine-as-action` cannot configure exit "%s" to show a view.  The return value from the exit is used as view locals (variables accessible inside the view HTML), so the exit\'s `example` must be a dictionary (`{}`).  But instead, it\'s: ', exitName, util.inspect(exitDef.example, false, null)));
      }
    }
    else if (resMeta.responseType === 'json') {
      if (_.isUndefined(exitDef.example)) {
        throw new Error(util.format('`machine-as-action` cannot configure exit "%s" to respond with JSON.  The return value from the exit will be encoded as JSON, so something must be returned...but the exit\'s `example` is undefined.', exitName));
      }
    }

    // Log warning if unnecessary stuff is provided (i.e. a `view` was provided along with responseType !== "view")
    if (resMeta.viewPath && resMeta.responseType !== 'view') {
      console.error('Warning: unnecessary `view` response metadata provided for an exit which is not configured to respond with a view (actual responseType => "%s").', resMeta.responseType);
    }

    memo[exitName] = resMeta;
    return memo;
  }, {});

}
