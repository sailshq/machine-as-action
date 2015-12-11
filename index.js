/**
 * Module dependencies
 */

var util = require('util');
var _ = require('lodash');
var Machine = require('machine');
var normalizeResponses = require('./helpers/normalize-responses');

/**
 * machine-as-action
 *
 * Build a conventional controller action (i.e. route handling function)
 * from a machine definition.  This wraps the machine in a function which
 * negotiates exits to the appropriate response method (e.g. res.negotiate)
 * and passes in all of the request parameters as inputs, as well as a few
 * other useful properties on `env` including:
 *  • req
 *  • res
 *
 *
 *
 * Usage:
 * ------------------------------------------------------------------------------------------------
 * @param  {Dictionary} optsOrMachineDef
 *           @required {Dictionary} machine
 *                       A machine definition.
 *
 *           @optional {Dictionary} responses
 *                       A set of static/lift-time response customizations.
 *                       Each key refers to a particular machine exit, and each
 *                       value is a dictionary of settings.
 *                       TODO: document settings
 *
 *           @optional {Array} files
 *
 *
 * -OR-
 *
 *
 * @param  {Dictionary} optsOrMachineDef
 *                       A machine definition.
 *
 *===
 *
 * @return {Function}
 *         @param {Request} req
 *         @param {Response} res
 * ------------------------------------------------------------------------------------------------
 */

module.exports = function machineAsAction(optsOrMachineDef) {

  optsOrMachineDef = optsOrMachineDef||{};

  // Use either `optsOrMachineDef` or `optsOrMachineDef.machine` as the machine definition
  var machineDef;
  if (!_.isObject(optsOrMachineDef.machine)) {
    machineDef = optsOrMachineDef || {};
  }
  else {
    machineDef = (optsOrMachineDef||{}).machine || {};
  }

  // Extend a default def with the actual provided def to allow for a laxer specification.
  machineDef = _.extend({
    identity: machineDef.friendlyName||'anonymous-action',
    inputs: {},
    exits: {},
    fn: function (inputs, exits){
      exits.error(new Error('Not implemented yet!'));
    }
  },machineDef);

  // Build machine instance: a "wet" machine.
  // (This is just like a not-yet-configured "part" or "machine instruction".)
  //
  // This gives us access to the instantiated inputs and exits.
  var wetMachine = Machine.build(machineDef);

  // If any static response customizations/metadata were specified via `optsOrMachineDef`, combine
  // them with the exit definitions of the machine to build a normalized response mapping that will
  // be cached so it does not need to be recomputed again and again at runtime with each incoming
  // request. (e.g. non-dyamic things like status code, response type, view name, etc)
  var responses = normalizeResponses(optsOrMachineDef.responses || {}, wetMachine.exits);
  // Be warned that this caching is **destructive**.  In other words, if a dictionary was provided
  // for `optsOrMachineDef.responses`, it will be irreversibly modified.




  /**
   * `_requestHandler()`
   *
   * At runtime, this code will be invoked each time the router receives a request and sends it to this action.
   * --------------------------------------------------------------------------------------------------------------
   * @param  {Request} req
   * @param  {Response} res
   */
  return function _requestHandler(req, res) {

    // Validate `req` and `res`
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // Note: we really only need to do these checks once, but they're a neglible hit to performance,
    // and the extra µs is worth it to ensure continued compatibility when coexisting with other
    // middleware, policies, frameworks, packages, etc. that might tamper with the global `req`
    // object (e.g. Passport).
    ///////////////////////////////////////////////////////////////////////////////////////////////////

    // Vanilla Express app requirements
    if (!res.json) {
      throw new Error('`machine-as-action` requires `res.json()` to exist (i.e. a Sails.js or Express app)');
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


    // Specify arguments (aka "input configurations") for the machine.
    ///////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Machine arguments can be derived from any of the following sources:
    //
    //  (1) TEXT PARAMETERS:
    //      Use a request parameter as an argument.
    //      - Any conventional Sails/Express request parameter is supported;
    //        i.e. from any combination of the following sources:
    //       ° URL pattern variables (match groups in path; e.g. `/monkeys/:id/uploaded-files/*`)
    //       ° The querystring (e.g. `?foo=some%20string`)
    //       ° The request body (may be URL-encoded or JSON-serialized)
    //
    //  (2) FILES:
    //      Use one or more incoming file upstreams as an argument.
    //      - Upstreams are multifile upload streams-- they are like standard multipart file upload
    //        streams except that they support multiple files at a time.  To manage RAM usage, they
    //        support TCP backpressure.  Upstreams also help prevent DoS attacks by removing the
    //        buffering delay between the time a potentially malicious file starts uploading and
    //        when your validation logic runs.  That means no incoming bytes are written to disk
    //        before your code has had a chance to take a look.  If your use case demands it, you
    //        can even continue to perform incremental validations as the file uploads (i.e. to
    //        scan for malicious code or unexpectedly formatted data) or gradually pipe the stream
    //        to `/dev/null` (a phony destination) as a honeypot to fool would-be attackers into
    //        thinking their upload was successful.
    //      - Upstream support is implemented by the Skipper body parser (a piece of middleware).
    //        Skipper is the default body parser in Sails, but it is compatible with Express,
    //        Connect, Hapi, or any other framework that exposes a conventional `req`/`res`/`next`
    //        interface for its middleware stack.
    //        body parser. event streams that emit multipart file upload streams) via Skipper.
    //      - Any receiving input(s) may continue to be either required or optional, but they must
    //        declare themselves refs by setting `example: '==='`. If not, then `machine-as-action`
    //        will refuse to rig this machine.
    //
    //  (3) HEADERS:
    //      Use an HTTP request headers as an argument.   (-NOT YET SUPPORTED-)
    //      - Any receiving input(s) may continue to be either required or optional, but they must
    //        declare a string example.
    //
    ///////////////////////////////////////////////////////////////////////////////////////////////

    // Build `argins` (aka input configurations), a dictionary that maps each input's codeName to the
    // appropriate argument.
    var argins = _.reduce(wetMachine.inputs, function (memo, inputDef, inputCodeName) {

      // If this input is named "*", we understand that this is indicating it's special; that it represents
      // a special, agressive kind of match group that sometimes appears in URL patterns.  This special match group
      // is known as a "wildcard suffix".
      if (inputCodeName === '*') {
        memo[inputCodeName] = req.param('0');
      }
      // Otherwise, this is just your standard, run of the mill input.
      else {
        memo[inputCodeName] = req.param(inputCodeName);
      }

      // ---
      // Note: formerly, we omitted `undefined` values from this dictionary.
      // This doesn't seem to be necessary, so I removed it.  But leaving a note
      // here in case we're freaking out later trying to figure out why the world
      // is falling apart.    ~mm dec11,2015
      // ```
      // if (!_.isUndefined(paramVal)) { memo[inputCodeName] = paramVal; } return memo;
      // ```
      // ---

      return memo;
    }, {});



    // Handle `files` option (to provide access to upstreams)
    if (_.isArray(optsOrMachineDef.files)) {
      if (!req.file) {
        throw new Error('In order to use the `files` option, `machine-as-action` requires `req.file()` to exist (i.e. a Sails.js, Express, or Hapi app using Skipper)');
      }
      _.each(optsOrMachineDef.files, function (fileParamName){
        argins[fileParamName] = req.file(fileParamName);
      });
    }

    // TODO: eventually implement support for sourcing inputs from headers.
    //       (mapping as closely as possible to Swagger's syntax -- not just for familiarity, but
    //        also to maintain and strengthen the underlying conventions)


    // Pass argins to the machine.
    var liveMachine = wetMachine.configure(argins);


    // Build and set `env`
    ///////////////////////////////////////////////////////////////////////////////////////////////

    // Provide `env.req` and `env.res`
    var env = {
      req: req,
      res: res
    };

    // If this is a Sails app, provide `env.sails` for convenience.
    if (req._sails) {
      env.sails = req._sails;
    }

    // Expose `env` in machine `fn`.
    liveMachine.setEnvironment(env);



    // Now prepare some exit callbacks that map each exit to a particular response.
    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Just like a machine's `fn` _must_ call one of its exits, this action _must_ send a response.
    // But it can do so in a number of different ways:
    //
    //  (1) ACK:           Do not send a response body.
    //                     - Useful in situations where response data is unnecessary/wasteful,
    //                       e.g. after successfully updating a resource like `PUT /discoparty/7`.
    //                     - The status code and any response headers will still be sent.
    //                     - Even if the machine exit returns any output, it will be ignored.
    //
    //
    //  (2) PLAIN TEXT:    Send plain text.
    //                     - Useful for sending raw data in a format like CSV or XML.
    //                     - The *STRING* output from the machine exit will be sent verbatim as the
    //                       response body. Custom response headers like "Content-Type" can be sent
    //                       using `env.res.set()` or mp-headers.  For more info, see "FILE" below.
    //                     - If the exit does not guarantee a *STRING* output, then `machine-as-action`
    //                       will refuse to rig this machine.
    //
    //
    //  (3) JSON:          Send data encoded as JSON.
    //                     - Useful for a myriad of purposes; e.g. mobile apps, IoT devices, CLI
    //                       scripts or daemons, SPAs (single-page apps) or any other webpage
    //                       using AJAX (whether over HTTP or WebSockets), other API servers, and
    //                       pretty much anything else you can imagine.
    //                     - The output from the machine exit will be stringified before it is sent
    //                       as the response body, so it must be JSON-compatible in the eyes of the
    //                       machine spec (i.e. lossless across JSON serialization and without circular
    //                       references).
    //                     - That is, if the exit's output example contains any lamda (`->`) or
    //                       ref (`===`) tokens, `machine-as-action` will refuse to rig this machine.
    //
    //
    //  (4) FILE:          Download a file.
    //                     - Files are useful sometimes.
    //                     - Note that any response headers you might want to use such as `content-type`
    //                       and `content-disposition` should be set in the implementation of your
    //                       machine using `env.res.set()`.
    //                     - For advanced documentation on `env.res.set()`, check out Sails docs:
    //                         [Docs](http://sailsjs.org/documentation/reference/response-res/res-set)
    //                     - Or if you're looking for something higher-level:
    //                         [Install](http://node-machine.org/machinepack-headers/set-response-header)
    //                     - If the example guaranteed from the machine exit is:
    //                       • a number, boolean, JSON-compatible:
    //                          then it will be encoded
    //                       -- a buffer or a readable stream:
    //                          then it will be streamed back to the requesting user-agent as binary.
    //                       user-agent as a stream.  If the output from the machine exit is a
    //                       readable
    //
    //
    //  (5) REDIRECT:      Redirect the requesting user-agent to a different URL.
    //                     - The *STRING* output by sending a "Location" header with the
    //
    //
    //  (6) VIEW:          Responds with an HTML webpage.
    //                     - The dictionary output from the machine exit will be passed to the view
    //                       template as "locals".  Each key from this dictionary will be accessible
    //                       as a local variable in the view template.
    //                     - If the exit's output example is not a generic or faceted dictionary,
    //                       then `machine-as-action` will refuse to rig this machine.
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    var callbacks = {};
    _.each(_.keys(wetMachine.exits), function builtExitCallback(exitCodeName){

      // Build a callback for this exit that sends the appropriate response.
      callbacks[exitCodeName] = function respondApropos(output){

        // Encode exit name as a response header (involves breaking this up into each of the exits specified by the machine definition)
        res.set('X-Exit', exitCodeName);

        switch (responses[exitCodeName].responseType) {
          case 'error':
            // If there is no output, build an error message explaining what happened.
            return res.negotiate(!_.isUndefined(output) ? output : new Error(util.format('Action for route "%s %s" encountered an error, triggering its "%s" exit. No additional error data was provided.', req.method, req.path, exitCodeName) ));
          case 'status':
            return res.send(responses[exitCodeName].statusCode);
          case 'json':
            return res.json(responses[exitCodeName].statusCode, output);
          case 'redirect':
            // If `res.redirect()` is missing, we have to complain.
            // (but if this is a Sails app and this is a Socket request, let the framework handle it)
            if (!_.isFunction(res.redirect) && !(req._sails && req.isSocket)) {
              throw new Error('Cannot redirect this request because `res.redirect()` does not exist.  Is this an HTTP request to a conventional server (i.e. Sails.js/Express)?');
            }
            return res.redirect(responses[exitCodeName].statusCode, output);
          case 'view':
            // If `res.view()` is missing, we have to complain.
            // (but if this is a Sails app and this is a Socket request, let the framework handle it)
            if (!_.isFunction(res.view) && !(req._sails && req.isSocket)) {
              throw new Error('Cannot render a view for this request because `res.view()` does not exist.  Are you sure this an HTTP request to a Sails.js server with the views hook enabled?');
            }
            res.statusCode = responses[exitCodeName].statusCode;
            return res.view(responses[exitCodeName].viewPath, output);
          default:
            return res.negotiate(new Error('Encountered unexpected error in `machine-as-action`: "unrecognized response type".  Please report this issue at `https://github.com/treelinehq/machine-as-action/issues`'));
        }
      };
    });

    // Then attach them and `.exec()` the machine.
    return liveMachine.exec(callbacks);

  };
};


