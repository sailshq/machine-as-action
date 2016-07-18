/**
 * Module dependencies
 */

var util = require('util');
var _ = require('lodash');
var getOutputExample = require('./get-output-example');


/**
 * Merge the provided `responses` metadata with the exits from the machine definition,
 * sanitize and validate the results, then return the normalized `responses` dictionary.
 *
 * @param  {Dictionary} configuredResponses
 * @param  {Dictionary} exits
 * @return {Dictionary}      [normalized response metadata for each exit]
 *
 * NOTE THAT THIS FUNCTION MUTATES BOTH THE PROVIDED `configuredResponses` AND THE PROVIDED `exits`!
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

    // If a response def exists, merge its properties into the exit definition.
    if (configuredResponses[exitCodeName]) {
      _.extend(exitDef, configuredResponses[exitCodeName]);
    }

    // Backwards compatibility:
    //
    // • `view` (=> `viewTemplatePath`)
    if (!_.isUndefined(exitDef.view)) {
      console.warn('Deprecated: `view` is no longer supported by `machine-as-action`.  Instead, use `viewTemplatePath`.  (Automatically migrating for you this time.)');
      exitDef.viewTemplatePath = exitDef.view;
    }
    // • `viewPath` (=> `viewTemplatePath`)
    else if (!_.isUndefined(exitDef.viewPath)) {
      console.warn('Deprecated: `viewPath` is no longer supported by `machine-as-action`.  Instead, use `viewTemplatePath`.  (Automatically migrating for you this time.)');
      exitDef.viewTemplatePath = exitDef.viewPath;
    }


    // If response metadata was explicitly defined, use it.
    // (also validate each property on the way in to ensure it is valid)
    //
    // Response type (`responseType`)
    if (!_.isUndefined(exitDef.responseType)) {
      if (!_.contains(['', 'error', 'status', 'json', 'redirect', 'view'], exitDef.responseType)) {
        throw new Error(util.format('`machine-as-action` doesn\'t know how to handle the response type ("%s") specified for exit "%s".', exitDef.responseType, exitCodeName));
      }
    }
    // Status code (`statusCode`)
    if (!_.isUndefined(exitDef.statusCode)) {
      exitDef.statusCode = +exitDef.statusCode;
      if (_.isNaN(exitDef.statusCode) || exitDef.statusCode < 100 || exitDef.statusCode > 599) {
        throw new Error(util.format('`machine-as-action` doesn\'t know how to handle the status code ("%s") specified for exit "%s".  To have MaA use the default status code, omit the `statusCode` property.', exitDef.statusCode, exitCodeName));
      }
    }
    // View path (`viewTemplatePath`)
    if (!_.isUndefined(exitDef.viewTemplatePath)) {
      if (!_.isString(exitDef.viewTemplatePath)) {
        throw new Error(util.format('`machine-as-action` doesn\'t know how to handle the view path ("%s") specified for exit "%s".', exitDef.viewTemplatePath, exitCodeName));
      }
    }



    // Then set any remaining unspecified stuff to reasonable defaults.
    // (note that this makes decisions about how to respond based on the
    //  static exit definition, not the runtime output value.)


    // If `responseType` is not set, we assume it must be `` (standard)
    // unless this is the error exit, in which case we assume it must be `error`.
    if (_.isUndefined(exitDef.responseType)) {
      if (exitCodeName === 'error') {
        exitDef.responseType = 'error';
      }
      else {
        exitDef.responseType = ''; // ("" <=> standard)
      }
    }

    // If status code was not explicitly specified, infer an appropriate code based on the response type and/or exitCodeName.
    if (!exitDef.statusCode) {
      // First, if this is the error exit or this response is using the "error" response type:
      // `500`   (response type: error) -OR- (error exit-- should always be response type: 'error' anyway, this is just a failsafe)
      if (exitDef.responseType === 'error' || exitCodeName === 'error') {
        exitDef.statusCode = 500;
      }
      // Otherwise, if this is a redirect:
      // `302` (redirect)
      else if (exitDef.responseType === 'redirect') {
        exitDef.statusCode = 302;
      }
      // Otherwise, if this is the success exit:
      // `200` (success exit)
      else if (exitCodeName === 'success') {
        exitDef.statusCode = 200;
      }
      // Otherwise... well, this must be some other exit besides success and error
      // and it must not be doing a redirect, so use:
      // `500` (misc)
      else {
        exitDef.statusCode = 500;
      }
    }

    // Look up the output example for this exit.
    var outputExample = getOutputExample({ exitDef: exitDef });

    // Ensure response type is compatible with exit definition
    if (exitDef.responseType === 'redirect') {
      if (!_.isUndefined(outputExample) && !_.isString(outputExample)) {
        throw new Error(util.format('`machine-as-action` cannot configure exit "%s" to redirect.  The redirect URL is based on the return value from the exit, so the exit\'s `example` must be a string.  But instead, it\'s: ', exitCodeName,util.inspect(outputExample, false, null)));
      }
    }
    else if (exitDef.responseType === 'view') {
      if (!_.isUndefined(outputExample) && !_.isPlainObject(outputExample)) {
        throw new Error(util.format('`machine-as-action` cannot configure exit "%s" to show a view.  The return value from the exit is used as view locals (variables accessible inside the view HTML), so the exit\'s `example` must be a dictionary (`{}`).  But instead, it\'s: ', exitCodeName, util.inspect(outputExample, false, null)));
      }
    }
    else if (exitDef.responseType === 'json') {
      // ** NOTE THAT THE `json` RESPONSE TYPE IS DEPRECATED **
      if (!_.isUndefined(outputExample) && _.isUndefined(outputExample)) {
        throw new Error(util.format('`machine-as-action` cannot configure exit "%s" to respond with JSON.  The return value from the exit will be encoded as JSON, so something must be returned...but the exit\'s `example` is undefined.', exitCodeName));
      }
    }

    // Log warning if unnecessary stuff is provided (i.e. a `view` was provided along with responseType !== "view")
    if (exitDef.viewTemplatePath && exitDef.responseType !== 'view') {
      console.error('Warning: unnecessary `view` response metadata provided for an exit which is not configured to respond with a view (actual responseType => "%s").', exitDef.responseType);
    }

    memo[exitCodeName] = exitDef;
    return memo;
  }, {});

};
