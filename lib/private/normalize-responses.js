/**
 * Module dependencies
 */

var util = require('util');
var _ = require('@sailshq/lodash');
var flaverr = require('flaverr');
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
 * @throws {Error} If exit/response metadata is invalid or if machine-as-action doesn't know how to handle it
 *         @property {String} code  (===E_INVALID_RES_METADATA_IN_EXIT_DEF)
 */
module.exports = function normalizeResponses(configuredResponses, exits) {

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


  // Return normalized exit definitions.
  return _.reduce(exits, function(memo, exitDef, exitCodeName) {

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
    // ================================================================================================

    // Response type (`responseType`)
    if (!_.isUndefined(exitDef.responseType)) {

      // Allow any response type, but make sure it's a string at least.
      if (!_.isString(exitDef.responseType)) {
        throw flaverr(
          'E_INVALID_RES_METADATA_IN_EXIT_DEF',
          new Error(util.format('`machine-as-action` doesn\'t know how to handle the response type ("%s") specified for exit "%s".  (Should be either omitted, or specified as a string.)', exitDef.responseType, exitCodeName))
        );
      } //-•

    } //>-•

    // Status code (`statusCode`)
    if (!_.isUndefined(exitDef.statusCode)) {

      // Ensure it's a number.
      exitDef.statusCode = +exitDef.statusCode;
      if (!_.isNumber(exitDef.statusCode) || _.isNaN(exitDef.statusCode) || exitDef.statusCode < 100 || exitDef.statusCode > 599) {
        throw flaverr(
          'E_INVALID_RES_METADATA_IN_EXIT_DEF',
          new Error(util.format('`machine-as-action` doesn\'t know how to handle the status code ("%s") specified for exit "%s".  To have this exit infer an appropriate default status code, just omit the `statusCode` property.', exitDef.statusCode, exitCodeName))
        );
      }

    } //>-•

    // View path (`viewTemplatePath`)
    if (!_.isUndefined(exitDef.viewTemplatePath)) {
      if (exitDef.viewTemplatePath === '' || !_.isString(exitDef.viewTemplatePath)) {
        throw flaverr(
          'E_INVALID_RES_METADATA_IN_EXIT_DEF',
          new Error(util.format('`machine-as-action` doesn\'t know how to handle the view template path ("' + exitDef.viewTemplatePath + '") specified as the `viewTemplatePath` for exit "' + exitCodeName + '".  This should be the relative path to a view file from the `views/` directory, minus the extension (`.ejs`).'))
        );
      }
    } //>-•



    // Then set any remaining unspecified stuff to reasonable defaults.
    // (note that the code below makes decisions about how to respond based on the
    //  static exit definition, not the runtime output value.)
    // ==============================================================================================================


    // If `responseType` is not set, we assume it must be "" (empty string / standard), UNLESS:
    // • if a `viewTemplatePath` was provided, in which case we assume it must be `view`
    // • or otherwise if this is the error exit, in which case we assume it must be `error`
    if (_.isUndefined(exitDef.responseType)) {

      if (exitDef.viewTemplatePath) {
        exitDef.responseType = 'view';
      } else if (exitCodeName === 'error') {
        exitDef.responseType = 'error';
      } else {
        exitDef.responseType = ''; // ("" <=> standard)
      }

    } //>-


    // Infer appropriate status code:
    //
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
      // Otherwise, if this a view, always use the 200 status code by default.
      // `200` (view)
      else if (exitDef.responseType === 'view') {
        exitDef.statusCode = 200;
      }
      // Otherwise... well, this must be some other exit besides success and error
      // and it must not be doing a redirect, so use:
      // `500` (misc)
      else {
        exitDef.statusCode = 500;
      }
    } //>-

    // Look up the output example for this exit.
    var outputExample = getOutputExample({
      exitDef: exitDef
    });

    // Ensure response type is compatible with exit definition
    if (exitDef.responseType === 'redirect') {
      // Note that we tolerate the absense of an outputExample, since a redirect is assumed to always be a string.
      if (!_.isUndefined(outputExample) && !_.isString(outputExample)) {
        throw flaverr(
          'E_INVALID_RES_METADATA_IN_EXIT_DEF',
          new Error(util.format('Cannot configure exit "%s" to redirect.  The redirect URL is based on the return value from the exit, so the exit\'s `outputExample` must be a string.  But instead, it is: ', exitCodeName, util.inspect(outputExample, false, null)))
        );
      } //-•

      // If no outputExample was specified, modify the exit in-memory to make it a string.
      // This is criticial, otherwise the machine runner will convert the runtime output into an Error instance,
      // since it'll think the exit isn't expecting any output (note that we also set the `outputExample` local
      // variable, just for consistency.)
      if (_.isUndefined(outputExample)) {
        outputExample = '/some/other/place';
        exitDef.outputExample = outputExample;
        // Currently, we have to set BOTH `outputExample` and `example`.
        // This will be normalized soon in a patch release of the machine runner, and at that
        // point, this line can be removed:
        // ------------------------------------------------
        exitDef.example = outputExample;
        // ------------------------------------------------
      }

    } else if (exitDef.responseType === 'view') {
      // Note that we tolerate `===` so that it can be used for performance reasons.
      // If no output example is provided, we treat it like `===`.
      if (!_.isUndefined(outputExample) && outputExample !== '===' && !_.isPlainObject(outputExample)) {
        throw flaverr(
          'E_INVALID_RES_METADATA_IN_EXIT_DEF',
          new Error(util.format('Cannot configure exit "%s" to show a view.  The return value from the exit is used as view locals (variables accessible inside the view HTML), so the exit\'s `outputExample` must be some sort of dictionary (`{}`).  But instead, it\'s: ', exitCodeName, util.inspect(outputExample, false, null)))
        );
      }
    } else if (exitDef.responseType === 'json') {
      // ** NOTE THAT THE `json` RESPONSE TYPE IS DEPRECATED **
      if (!_.isUndefined(outputExample) && _.isUndefined(outputExample)) {
        throw flaverr(
          'E_INVALID_RES_METADATA_IN_EXIT_DEF',
          new Error(util.format('Cannot configure exit "%s" to respond with JSON.  The return value from the exit will be encoded as JSON, so something must be returned...but the exit\'s `outputExample` is undefined.', exitCodeName))
        );
      }
    } //>-•

    // Log warning if unnecessary stuff is provided (i.e. a `view` was provided along with responseType !== "view")
    if (exitDef.viewTemplatePath && exitDef.responseType !== 'view') {
      console.error('Warning: unnecessary `viewTemplatePath` (response metadata) provided for an exit which is not configured to respond with a view (actual responseType => "' + exitDef.responseType + '").  To resolve, set `responseType: \'view\'`.');
    } //>-

    memo[exitCodeName] = exitDef;
    return memo;
  }, {});

};
