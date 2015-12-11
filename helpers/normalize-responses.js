/**
 * Module dependencies
 */

var util = require('util');
var _ = require('lodash');



/**
 * Merge the provided `responses` metadata with the exits from the machine definition,
 * sanitize and validate the results, then return the normalized `responses` dictionary.
 *
 * @param  {Dictionary} configuredResponses
 * @param  {Dictionary} exits
 * @return {Dictionary}      [normalized response metadata for each exit]
 *
 * @throws {Error} If [machine-as-action doesn't know how to handle something.]
 */
module.exports = function normalizeResponses (configuredResponses, exits){

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

  return _.reduce(exits, function (memo, exitDef, exitCodeName) {
    var resMeta = {};

    // If response metadata was explicitly defined, use it.
    // (also validate each property on the way in to ensure it is valid)
    if ( _.isObject(configuredResponses[exitCodeName]) ){
      // Response type (`responseType`)
      if (!_.isUndefined(configuredResponses[exitCodeName].responseType)) {
        resMeta.responseType = configuredResponses[exitCodeName].responseType;
        if (!_.contains(['standard', 'error', 'status', 'json', 'redirect', 'view'], resMeta.responseType)) {
          throw new Error(util.format('`machine-as-action` doesn\'t know how to handle the response type ("%s") specified for exit "%s".', resMeta.responseType, exitCodeName));
        }
      }
      // Status code (`status`)
      if (!_.isUndefined(configuredResponses[exitCodeName].status)) {
        resMeta.statusCode = +configuredResponses[exitCodeName].status;
        if (_.isNaN(resMeta.statusCode) || resMeta.statusCode < 100 || resMeta.statusCode > 599) {
          throw new Error(util.format('`machine-as-action` doesn\'t know how to handle the status code ("%s") specified for exit "%s".', resMeta.statusCode, exitCodeName));
        }
      }
      // View path (`view`)
      if (!_.isUndefined(configuredResponses[exitCodeName].view)) {
        resMeta.viewPath = configuredResponses[exitCodeName].view;
        if (!_.isString(resMeta.viewPath)) {
          throw new Error(util.format('`machine-as-action` doesn\'t know how to handle the view ("%s") specified for exit "%s".', resMeta.viewPath, exitCodeName));
        }
      }
      // Should not allow explicit/hard-coded output data override here-
      // instead just send that hard-coded data out of the machine exit.
    }

    // Then set any remaining unspecified stuff to reasonable defaults.
    // (note that this makes decisions about how to respond based on the
    //  static exit definition, not the runtime output value.)


    // If `responseType` is not set, we assume it must be `standard`
    // unless this is the error exit, in which case we assume it must be `error`.
    if (!resMeta.responseType) {
      if (exitCodeName === 'error') {
        resMeta.responseType = 'error';
      }
      else {
        resMeta.responseType = 'standard';
      }
    }

    // If status code was not explicitly specified, infer an appropriate code based on the response type and/or exitCodeName.
    if (!resMeta.statusCode) {
      // First, if this is the error exit or this response is using the "error" response type:
      // `500`   (response type: error) -OR- (error exit-- should always be response type: 'error' anyway, this is just a failsafe)
      if (resMeta.responseType === 'error' || exitCodeName === 'error') {
        resMeta.statusCode = 500;
      }
      // Otherwise, if this is a redirect:
      // `302` (redirect)
      else if (resMeta.responseType === 'redirect') {
        resMeta.statusCode = 302;
      }
      // Otherwise, if this is a view OR it's the success exit:
      // `200` (view)  -OR-  (success exit)
      else if (resMeta.responseType === 'view' || exitCodeName === 'success') {
        resMeta.statusCode = 200;
      }
      // Otherwise... well, this must be some other exit besides success and error
      // and it must not be doing a redirect or serving a view:
      // `500` (any other exit besides success)
      else {
        resMeta.statusCode = 500;
      }
    }

    // Ensure response type is compatible with exit definition
    if (resMeta.responseType === 'redirect') {
      if (!_.isUndefined(exitDef.example) && !_.isString(exitDef.example)) {
        throw new Error(util.format('`machine-as-action` cannot configure exit "%s" to redirect.  The redirect URL is based on the return value from the exit, so the exit\'s `example` must be a string.  But instead, it\'s: ', exitCodeName,util.inspect(exitDef.example, false, null)));
      }
    }
    else if (resMeta.responseType === 'view') {
      if (!_.isUndefined(exitDef.example) && !_.isPlainObject(exitDef.example)) {
        throw new Error(util.format('`machine-as-action` cannot configure exit "%s" to show a view.  The return value from the exit is used as view locals (variables accessible inside the view HTML), so the exit\'s `example` must be a dictionary (`{}`).  But instead, it\'s: ', exitCodeName, util.inspect(exitDef.example, false, null)));
      }
    }
    else if (resMeta.responseType === 'json') {
      if (!_.isUndefined(exitDef.example) && _.isUndefined(exitDef.example)) {
        throw new Error(util.format('`machine-as-action` cannot configure exit "%s" to respond with JSON.  The return value from the exit will be encoded as JSON, so something must be returned...but the exit\'s `example` is undefined.', exitCodeName));
      }
    }

    // Log warning if unnecessary stuff is provided (i.e. a `view` was provided along with responseType !== "view")
    if (resMeta.viewPath && resMeta.responseType !== 'view') {
      console.error('Warning: unnecessary `view` response metadata provided for an exit which is not configured to respond with a view (actual responseType => "%s").', resMeta.responseType);
    }

    memo[exitCodeName] = resMeta;
    return memo;
  }, {});

};
