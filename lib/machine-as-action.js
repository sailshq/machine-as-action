/**
 * Module dependencies
 */

var util = require('util');
var Stream = require('stream');
var _ = require('@sailshq/lodash');
var Streamifier = require('streamifier');
var rttc = require('rttc');
var flaverr = require('flaverr');
var Machine = require('machine');
var normalizeResponses = require('./private/normalize-responses');
var getOutputExample = require('./private/get-output-example');

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// FUTURE: Pull this into Sails core to ease maintenance.
// > In general, we're looking to reduce the number of separate repos
// > and NPM packages we have to maintain-- so any time there's
// > something that was extrapolated without it _actually_ needing
// > to be separate, we're folding it back in.
// >
// > If you're using this module in your Express/misc Node.js project
// > that doesn't use Sails, and would prefer it didn't get folded
// > into core, please let us know (https://sailsjs.com/support).
// >
// > -mikermcneil  (Nov 11, 2017)
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

/**
 * machine-as-action
 *
 * Build a conventional controller action (i.e. route handling function)
 * from a machine definition.  This wraps the machine in a function which
 * negotiates exits to the appropriate response behavior, and passes in all
 * of the request parameters as inputs, as well as a few other useful properties
 * on `env` including:
 *  • req
 *  • res
 *
 *
 *
 * Usage:
 * ------------------------------------------------------------------------------------------------
 * @param  {Dictionary} optsOrMachineDef
 *           @required {Dictionary} machine
 *                       A machine definition, with action-specific extensions (e.g. `statusCode` in exits)
 *                       Note that the top-level properties of the machine definition may alternatively
 *                       just be included inline amongst the other machine-as-action specific options.
 *                       * * This inline inclusion is the **RECOMMENDED APPROACH** (see README.md). * *
 *
 *           @optional {Array} files
 *                     An array of input code names identifying inputs which expect to
 *                     receive file uploads instead of text parameters. These file inputs
 *                     must have `example: '==='`, but they needn't necessarily be
 *                     `required`.
 *                     @default  []
 *
 *                     e.g.
 *                     [ 'avatar' ]
 *
 *
 *
 *           @optional {String} urlWildcardSuffix
 *                     if '' or unspecified, then there is no wildcard suffix.  Otherwise,
 *                     this is the code name of the machine input which is being referenced
 *                     by the pattern variable serving as the wildcard suffix.
 *                     @default ''
 *
 *                     e.g.
 *                     'docPath'
 *
 *           @optional {Boolean} disableXExitHeader
 *                     if set, then do not set the `X-Exit` response header for any exit.
 *                     @default false
 *
 *           @optional {Boolean} disableDevelopmentHeaders
 *                     if set, then do not set headers w/ exit info during development.
 *                     Development headers include:
 *                       • `X-Exit-Friendly-Name`
 *                       • `X-Exit-Description`
 *                       • `X-Exit-Extended-Description`
 *                       • `X-Exit-More-Info-Url`
 *                       • `X-Exit-Output-Friendly-Name`
 *                       • `X-Exit-Output-Description`
 *                     These development headers are never shown in a production env
 *                     (i.e. when process.env.NODE_ENV === 'production') or when they
 *                     are not relevant.
 *                     @default false
 *
 *           @optional {Number} simulateLatency
 *                     if set, then simulate a latency of the specified number of milliseconds (e.g. 500)
 *                     @default 0
 *
 *           @optional {Boolean} logDebugOutputFn
 *                     An optional override function to call when any output other than `undefined` is
 *                     received from a void exit (i.e. an exit w/ no outputExample).
 *                     @default (use `sails.log.warn()` if available, or `console.warn()` otherwise.)
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

  // Use either `optsOrMachineDef` or `optsOrMachineDef.machine` as the node machine definition.
  // If `optsOrMachineDef.machine` is truthy, we'll use that as the machine definition.
  // Otherwise, we'll understand the entire `optsOrMachineDef` dictionary to be the machine
  // definition.  All other miscellaneous options are whitelisted.
  var machineDef;
  var options;
  var MISC_OPTIONS = [
    'files',
    'urlWildcardSuffix',
    'disableDevelopmentHeaders',
    'disableXExitHeader',
    'simulateLatency',
    'logDebugOutputFn',
    'implementationSniffingTactic',
    'responses'//<< deprecated, will be removed soon!
  ];
  if (!optsOrMachineDef.machine) {
    machineDef = optsOrMachineDef;
    options = _.pick(optsOrMachineDef, MISC_OPTIONS);
  }
  else {
    machineDef = optsOrMachineDef.machine;
    options = _.pick(optsOrMachineDef, MISC_OPTIONS);
  }

  if (!_.isObject(machineDef)) {
    throw new Error('Consistency violation: Machine definition must be provided as a dictionary.');
  }

  // https://github.com/treelinehq/machine-as-action/commit/d156299bc9cd85400bac3ab21b22dcbc3040bbda
  // Determine whether we are currently running in production.
  var IS_RUNNING_IN_PRODUCTION = (
    process.env.NODE_ENV === 'production'
  );


  // Set up default options:
  options = _.defaults(options, {
    simulateLatency: 0,
    // Note that the default implementation of `logDebugOutputFn` is inline below
    // (this is so that it has closure scope access to `req._sails`)
  });


  // If a function was provided, freak out.
  // (Unless this is a wet machine-- in which case it's ok)
  if (_.isFunction(machineDef)) {

    // If this is clearly an already "-as-action"-ified thing, then freak out in a more helpful way.
    if (machineDef.IS_MACHINE_AS_ACTION) {
      var doubleWrapErr = new Error('Cannot build action: Provided machine definition appears to have already been run through `machine-as-action`, or somehow otherwise decided to masquerade as an already-instantiated, live machine from MaA!');
      doubleWrapErr.code = 'E_DOUBLE_WRAP';
      throw doubleWrapErr;
    }
    // Otherwise, if this is a wet machine, that's OK-- we know how to handle it.
    else if (machineDef.isWetMachine) {
      // No worries.  It's ok.  Keep going.
    }
    // Otherwise just freak out.
    else {
      var invalidMachineDefErr = new Error('Cannot build action: Provided machine definition must be a dictionary, with an `fn`.  See http://node-machine.org/spec/machine for details.');
      invalidMachineDefErr.code = 'E_INVALID_MACHINE_DEF';
      throw invalidMachineDefErr;
    }
  }
  // --•

  // Extend a default def with the actual provided def to allow for a laxer specification.
  machineDef = _.extend({
    identity: machineDef.friendlyName ? _.kebabCase(machineDef.friendlyName) : 'anonymous-action',
    inputs: {},
    exits: {},
  }, machineDef);

  // If no `fn` was provided, dynamically build a stub fn that always responds with `success`,
  // using the `example` as output data, if one was specified.
  if (!machineDef.fn) {
    machineDef.fn = function (inputs, exits) {

      // This is a generated `fn`.
      // (Note that this is fine for production in some cases-- e.g. static views.)

      // Look up the output example for the success exit.
      var successExitOutputExample = getOutputExample({
        machineDef: machineDef,
        exitCodeName: 'success'
      });

      // If there's no output example, just exit through the success exit w/ no output.
      // (This is fine for production.  Because static views.)
      if (_.isUndefined(successExitOutputExample)) {
        return exits.success();
      }
      // Otherwise, still exit success, but use the output example (i.e. an exemplar)
      // as fake data.  This will be used as the locals, response data, or redirect URL
      // (depending on the exit's responseType, of course.)
      else {

        // Set a header to as a debug flag indicating this is just a stub.
        this.res.set('X-Stub', machineDef.identity);

        // But if you're in production, since this would respond with
        // a stub (i.e. fake data) then log a warning about this happening.
        // (since you probably don't actually want this to happen)
        if (IS_RUNNING_IN_PRODUCTION) {
          console.warn('Using stub implementation for action (`'+machineDef.identity+'`) because it has no `fn`!\n'+
          'That means the output sent from this action will be completely fake!  To do this, using the `outputExample` '+
          'from the success exit and using that as output.\n'+
          '(This warning is being logged because you are in a production environment according to NODE_ENV)');
        }//</if production>
        //>-

        return exits.success(successExitOutputExample);
      }


    };
  }


  // Mutate the machine definition.
  // Ensure the machine def has "success" and "error" exits.
  machineDef.exits = machineDef.exits || {};
  _.defaults(machineDef.exits, {
    error: { description: 'An unexpected error occurred.' },
    success: { description: 'Done.' }
  });

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // See `FUTURE` note below, as well as:
  // https://github.com/sailshq/machine-as-action/commit/b30e5b8cb1cc0522ca1fa1487896bcd3b83600c0
  //
  // This was removed to allow for new types of result validation to work properly.
  // (primarily useful for debugging why things aren't working)
  // ```
  // (In the current version of machine-as-action, as a way of minimizing complexity, we treat void exits
  // as if they are `outputExample: '==='`.  But to do this, we have to change the def beforehand.)
  //
  // _.each(_.keys(machineDef.exits), function(exitCodeName) {
  //   var exitDef = machineDef.exits[exitCodeName];
  //   if (undefined === exitDef.outputExample && undefined === exitDef.outputType && undefined === exitDef.like && undefined === exitDef.itemOf && undefined === exitDef.getExample) {
  //     exitDef.outputExample = '===';
  //   }
  // });
  // ```
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -



  // Build Callable (aka "wet" machine instance)
  // (This is just like a not-yet-configured "part" or "machine instruction".)
  //
  // This gives us access to the instantiated inputs and exits.
  var wetMachine = Machine.buildWithCustomUsage({
    def: machineDef,
    implementationSniffingTactic: options.implementationSniffingTactic||undefined
  });

  // If any static response customizations/metadata were specified via `optsOrMachineDef`, combine
  // them with the exit definitions of the machine to build a normalized response mapping that will
  // be cached so it does not need to be recomputed again and again at runtime with each incoming
  // request. (e.g. non-dyamic things like status code, response type, view name, etc)
  var responses;
  try {
    responses = normalizeResponses(options.responses || {}, wetMachine.getDef().exits);
  } catch (e) {
    switch (e.code) {
      case 'E_INVALID_RES_METADATA_IN_EXIT_DEF':
        // FUTURE: any additional error handling
        throw e;
      default: throw e;
    }
  }//</catch>
  wetMachine.getDef().exits = responses;
  // Be warned that this caching is **destructive**.  In other words, if a dictionary was provided
  // for `options.responses`, it will be irreversibly modified.  Also the exits in the
  // machine definition will be irreversibly modified.


  //  ██████╗ ██╗   ██╗██╗██╗     ██████╗      █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
  //  ██╔══██╗██║   ██║██║██║     ██╔══██╗    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
  //  ██████╔╝██║   ██║██║██║     ██║  ██║    ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
  //  ██╔══██╗██║   ██║██║██║     ██║  ██║    ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
  //  ██████╔╝╚██████╔╝██║███████╗██████╔╝    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
  //  ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚═════╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
  //

  /**
   * `_requestHandler()`
   *
   * At runtime, this code will be invoked each time the router receives a request and sends it to this action.
   * --------------------------------------------------------------------------------------------------------------
   * @param  {Request} req
   * @param  {Response} res
   */
  var action = function _requestHandler(req, res) {

    // Set up a local variable that will be used to hold the "live machine"
    // (which is a lot like a configured part or machine instruction)
    var deferred;


    // Validate `req` and `res`
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // Note: we really only need to do these checks once, but they're a neglible hit to performance,
    // and the extra µs is worth it to ensure continued compatibility when coexisting with other
    // middleware, policies, frameworks, packages, etc. that might tamper with the global `req`
    // object (e.g. Passport).
    ///////////////////////////////////////////////////////////////////////////////////////////////////

    // Sails/Express App Requirements
    if (!res.json) {
      throw new Error('Needs `res.json()` to exist (i.e. a Sails.js or Express app)');
    }
    if (!res.send) {
      throw new Error('Needs `res.send()` to exist (i.e. a Sails.js or Express app)');
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
    var argins = _.reduce(wetMachine.getDef().inputs, function (memo, inputDef, inputCodeName) {

      // If this input is called out by the `urlWildcardSuffix`, then we understand it as "*" from the
      // URL pattern.  This is indicating it's special; that it represents a special, agressive kind of match
      // group that sometimes appears in URL patterns.  This special match group is known as a "wildcard suffix".
      // It is just like any other match group except that it (1) can match forward slashes, (2) can only appear
      // at the very end of the URL pattern, and (3) there can only be one like it per route.
      //
      // Note that we compare against the code name in the input definition.  The `urlWildcardSuffix` provided to
      // machine-as-action should reference the c-input by code name, not by any other sort of ID (i.e. if you are
      // using a higher-level immutable ID abstraction, rewrite the urlWildcardSuffix to the code name beforehand)
      if (options.urlWildcardSuffix && options.urlWildcardSuffix === inputCodeName ) {
        memo[inputCodeName] = req.param('0');
      }
      // Otherwise, this is just your standard, run of the mill parameter.
      else {
        memo[inputCodeName] = req.param(inputCodeName);
      }

      // If a querystring-encoded parameter comes in as "" (empty string) for an input expecting a boolean
      // value, interpret that special case as `true`.
      if (inputDef.type === 'boolean' && req.query && req.query[inputCodeName] === '') {
        memo[inputCodeName] = true;
      }

      // If a querystring-encoded parameter comes in as "" (empty string) for an input expecting a NUMERIC value,
      // then tolerate that by ignoring the value altogether.
      if (inputDef.type === 'number' && req.query && req.query[inputCodeName] === '') {
        delete memo[inputCodeName];
      }

      return memo;
    }, {});



    // Handle `files` option (to provide access to upstreams)
    if (_.isArray(options.files)) {
      if (!req.file) {
        throw new Error('In order to use the `files` option, needs `req.file()` to exist (i.e. a Sails.js or Express app using Skipper)');
      }
      _.each(options.files, function (fileParamName){
        // Supply this upstream as an argument for the specified input.
        argins[fileParamName] = req.file(fileParamName);
        // Also bind an `error` event so that, if the machine's implementation (`fn`)
        // doesn't handle the upstream, or anything else goes wrong with the upstream,
        // it won't crash the server.
        argins[fileParamName].on('error', function (err){
          console.error('Upstream (file upload: `'+fileParamName+'`) emitted an error:', err);
        });//æ
      });//∞
    }//ﬁ

    // Eventually, we may consider implementing support for sourcing inputs from headers.
    //  (if so, we'll likely map as closely as possible to Swagger's syntax --
    //   not just for familiarity, but also to maintain and strengthen the underlying
    //   conventions)


    // Pass argins to the machine.
    deferred = wetMachine(argins);


    // Build and set metadata (aka "context" aka "habitat vars")
    ///////////////////////////////////////////////////////////////////////////////////////////////

    // Provide `this.req` and `this.res`
    var _meta = {
      req: req,
      res: res
    };

    // If this is a Sails app, provide `this.sails` for convenience.
    if (req._sails) {
      _meta.sails = req._sails;
    }

    // Set context for machine `fn`.
    deferred.meta(_meta);



    // Now prepare some exit callbacks that map each exit to a particular response.
    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Just like a machine's `fn` _must_ call one of its exits, this action _must_ send a response.
    // But it can do so in a number of different ways:
    //
    //  (1) ACK:           Do not send a response body.
    //  /\                 - Useful in situations where response data is unnecessary/wasteful,
    //  || nice-to-have      e.g. after successfully updating a resource like `PUT /discoparty/7`.
    //  || like plaintext  - The status code and any response headers will still be sent.
    //  || kinda advanced  - Even if the machine exit returns any output, it will be ignored.
    // (can use "" (aka standard) to achieve same effect)
    //
    //  (2) PLAIN TEXT:    Send plain text.
    //                     - Useful for sending raw data in a format like CSV or XML.
    //  /\                 - The *STRING* output from the machine exit will be sent verbatim as the
    //  || prbly wont be    response body. Custom response headers like "Content-Type" can be sent
    //  || implemented      using `this.res.set()` or mp-headers.  For more info, see "FILE" below.
    //  since you can just - If the exit does not guarantee a *STRING* output, then `machine-as-action`
    //  use "" to            will refuse to rig this machine.
    //  achieve the same
    //  effect.
    //
    //
    //  (3) JSON:          Send data encoded as JSON.
    //                     - Useful for a myriad of purposes; e.g. mobile apps, IoT devices, CLI
    //  /\                   scripts or daemons, SPAs (single-page apps) or any other webpage
    //  || nice-to-have      using AJAX (whether over HTTP or WebSockets), other API servers, and
    //  || but generally     pretty much anything else you can imagine.
    //  || achieveable w/  - The output from the machine exit will be stringified before it is sent
    //  || "".               as the response body, so it must be JSON-compatible in the eyes of the
    //  || Like plain text,  machine spec (i.e. lossless across JSON serialization and without circular
    //  || kinda advanced.   references).
    //  ||                 - That is, if the exit's output example contains any lamda (`->`) or
    //                       ref (`===`) hollows, `machine-as-action` will refuse to rig this machine.
    //
    //
    //  (4) "" (STANDARD): Send a response as versatile as you.
    //                     - Depending on the context, this might send plain text, download a file,
    //                       transmit data as JSON, or send no response body at all.
    //                     - Note that any response headers you might want to use such as `content-type`
    //                       and `content-disposition` should be set in the implementation of your
    //                       machine using `this.res.set()`.
    //                     - For advanced documentation on `this.res.set()`, check out Sails docs:
    //                         [Docs](http://sailsjs.org/documentation/reference/response-res/res-set)
    //                     - Or if you're looking for something higher-level:
    //                         [Install](http://node-machine.org/machinepack-headers/set-response-header)
    //
    //                     - If the |_output example_| guaranteed from the machine exit is:
    //                       • `null`/`undefined` - then that means there is no output.  Send only the
    //                         status code and headers (no response body).
    //                       • a number, boolean, generic dictionary, array, JSON-compatible (`*`), or a
    //                         faceted dictionary that DOES NOT contain ANY nested lamda (`->`) or ref
    //                         (`===`) hollows:
    //                            ...then the runtime output will be encoded with rttc.dehydrate() and
    //                               sent as JSON in the response body.  A JSON response header will be
    //                               automatically set ("Content-type: application/json").
    //                       • a lamda or a faceted dictionary that contains one or more lamda (`->`) and/or
    //                         ref (`===`) hollows:
    //                            ...then the runtime output will be encoded with rttc.dehydrate() and
    //                               sent as JSON in the response body.  A JSON response header will be
    //                               automatically set ("Content-type: application/json").
    //                               **************************************************************************
    //                               ******************************* WARNING **********************************
    //                               Since the output example indicates it might contain non-JSON-compatible
    //                               data, it is important to realize that transmitting this type of data in
    //                               the response body could be lossy.  For example, when rttc.dehydrate()
    //                               called, it toStrings functions into dehydrated cadavers andhumiliates
    //                               instances of JavaScript objects by wiping out their prototypal methods,
    //                               getters, setters, and any other hint of creativity that it finds. Objects
    //                               with circular references are spun around until they're dizzy, and their
    //                               circular references are replaced with strings (like doing util.inspect()
    //                               with a `null` depth).
    //                               **************************************************************************
    //                               **************************************************************************
    //                       • a ref:
    //                            ...then at runtime, the outgoing value will be sniffed.  If:
    //
    //                            (A) it is a (hopefully readable) STREAM of binary or UTF-8 chunks (i.e. NOT in
    //                                object mode):
    //                                ...then it will be piped back to the requesting client in the response.
    //
    //                            (B) it is a buffer:
    //                                ...then it will be converted to a readable binary stream...
    //                                ...and piped back to the requesting client in the response.
    //                            -------------------------------------------------------------------------------------
    //                            ^ IT IS IMPORTANT TO POINT OUT THAT, WHEN PIPING EITHER BUFFERS OR STREAMS, THE
    //                              CONTENT-TYPE IS SET TO OCTET STREAM UNLESS IT HAS ALREADY BEEN EXPLICITLY SPECIFIED
    //                              USING `this.res.set()` (in which case it is left alone).
    //                            -------------------------------------------------------------------------------------
    //                       ----- Note about responding w/ plain text: ------------------------------------------------------
    //                       If you need to respond with programatically-generated plain text, and you don't want it
    //                       encoded as JSON (or if you MUST NOT encode it as JSON for some reason), then you just need
    //                       to convert the plain text string variable into a readable stream (`===`) and feed it into
    //                       standard response.
    //                       ----- ==================================== ------------------------------------------------------
    //
    //                             (C) Finally, if the outgoing value at runtime does not match one of the two criteria above
    //                                 (e.g. if it is a readable stream in object mode, or an array of numbers, or a haiku--
    //                                 OR LITERALLY ANYTHING ELSE):
    //                                 ...then the runtime output will be encoded with rttc.dehydrate() and
    //                                    sent as JSON in the response body.  A JSON response header will be
    //                                    automatically set to ("Content-type: application/json").
    //                               *** PLEASE SEE WARNING ABOVE ABOUT `rttc.dehydrate()` ***
    //
    //
    //  (5) REDIRECT:      Redirect the requesting user-agent to a different URL.
    //                     - When redirecting, no response body is sent.  Instead, the *STRING* output
    //                       from the machine is sent as the "Location" response header.  This tells
    //                       the requesting device to go talk to that URL instead.
    //                     - If the exit's output example is not a string, then `machine-as-action`
    //                       will refuse to rig this machine.
    //
    //
    //  (6) VIEW:          Responds with an HTML webpage.
    //                     - The dictionary output from the machine exit will be passed to the view
    //                       template as "locals".  Each key from this dictionary will be accessible
    //                       as a local variable in the view template.
    //                     - If the exit's output example is not a generic or faceted dictionary,
    //                       then `machine-as-action` will refuse to rig this machine.
    //
    //  (7) ERROR:         Handle an error with an appropriate response.
    //  /\                 - Useful exclusively for error handling.  This just calls res.serverError()
    //  || warning:          and passes through the output.  If there is no output, it generates a
    //  || this will not     nicer error message and sends that through instead.
    //  || necessarily be  - If this is a Sails app, the server error response method in `api/responses/`
    //  || available for     will be used, and in some cases it will render the default error page (500.ejs)
    //  || exits other     - Note that, if the requesting user-agent is accessing the route from a browser,
    //     than `error`      its headers give it away.  The "error" response implements content negotiation--
    //     exits.            if a user-agent clearly accessed the "error" response by typing in the URL
    //                       of a web browser, then it should see an error page (which error page depends on the output).
    //                       Alternately, if the same exact parameters were sent to the same exact URL,
    //                       but via AJAX or cURL, we would receive a JSON response instead.
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    // We use a local variable (`exitAttempts`) as a spinlock.
    // (it tracks the code names of _which_ exit(s) were already triggered)
    var exitAttempts = [];

    var callbacks = {};
    _.each(_.keys(wetMachine.getDef().exits), function builtExitCallback(exitCodeName){

      // Build a callback for this exit that sends the appropriate response.
      callbacks[exitCodeName] = function respondApropos(output){

        // This spinlock protects against the machine calling more than one
        // exit, or the same exit twice.
        if (exitAttempts.length > 0) {
          console.warn('Consistency violation: When fulfilling this request (`'+req.method+' '+req.path+'`) '+
          'the action attempted to respond (i.e. call its exits) more than once!  An action should _always_ '+
          'send exactly one response.  This particular unexpected extra response was attempted via the `'+exitCodeName+'` '+
          'exit.  It was ignored.  For debugging purposes, here is a list of all exit/response attempts made '+
          'by this action:',exitAttempts);
          return;
        }
        exitAttempts.push(exitCodeName);

        (function _waitForSimulatedLatencyIfRelevant(_cb){
          if (!options.simulateLatency) { return _cb(); }
          setTimeout(_cb, options.simulateLatency);
        })(function afterwards(){
          // Use a `try` to be safe, since this callback might be invoked in
          // an asynchronous execution context.
          try {

            if (!res.headersSent) {

              // Unless being prevented with the `disableXExitHeader` option,
              // encode exit code name as the `X-Exit` response header.
              if (!options.disableXExitHeader) {
                res.set('X-Exit', exitCodeName);
              }

              // If running in development and development headers have not been explicitly disabled,
              // then send down other available metadata about the exit for convenience for developers
              // integrating with this API endpoint.
              var doSendDevHeaders = (
                !IS_RUNNING_IN_PRODUCTION &&
                !options.disableDevelopmentHeaders
              );
              if (doSendDevHeaders) {
                var responseInfo = responses[exitCodeName];
                if (responseInfo.friendlyName) {
                  res.set('X-Exit-Friendly-Name', responseInfo.friendlyName.replace(/\s*\n+\s*/g, ' '));
                }
                if (responseInfo.description) {
                  res.set('X-Exit-Description', responseInfo.description.replace(/\s*\n+\s*/g, ' '));
                }
                if (responseInfo.extendedDescription) {
                  res.set('X-Exit-Extended-Description', responseInfo.extendedDescription.replace(/\s*\n+\s*/g, ' '));
                }
                if (responseInfo.moreInfoUrl) {
                  res.set('X-Exit-More-Info-Url', responseInfo.moreInfoUrl.replace(/\s*\n+\s*/g, ' '));
                }
                // Only include output headers if there _is_ output and
                // this is a standard response:
                if (responseInfo.responseType === '' && !_.isUndefined(output)) {
                  if (responseInfo.outputFriendlyName) {
                    res.set('X-Exit-Output-Friendly-Name', responseInfo.outputFriendlyName.replace(/\s*\n+\s*/g, ' '));
                  }
                  if (responseInfo.outputDescription) {
                    res.set('X-Exit-Output-Description', responseInfo.outputDescription.replace(/\s*\n+\s*/g, ' '));
                  }
                }
                // Otherwise if this is a view response, include the view path.
                else if (responseInfo.responseType === 'view') {
                  res.set('X-Exit-View-Template-Path', responseInfo.viewTemplatePath.replace(/\s*\n+\s*/g, ' '));
                }
              }//</if running in a non-production environment without development headers explicitly disabled>
              // >-
              //
            }


            // If this is the handler for the error exit, and it's clear from the output
            // that this is a runtime validation error _from this specific machine_ (and
            // not from any machines it might call internally in its `fn`), then send back
            // send back a 400 (using the built-in `badRequest()` response, if it exists.)
            var isValidationError = (
              exitCodeName === 'error' &&
              output.name === 'UsageError' &&
              output.code === 'E_INVALID_ARGINS'
            );

            if (isValidationError) {
              // Sanity check:
              if (!_.isArray(output.problems)) { throw new Error('Consistency violation: E_INVALID_ARGINS errors should _always_ have a `problems` array.'); }

              // Build a new error w/ more specific verbiage.
              // (stack trace is more useful starting from here anyway)
              var prettyPrintedValidationErrorsStr = _.map(output.problems, function (problem){
                return '  • '+problem;
              }).join('\n');
              var baseValidationErrMsg =
              'Received incoming request (`'+req.method+' '+req.path+'`), '+
              'but could not run action (`'+machineDef.identity+'`) '+
              'due to '+output.problems.length+' missing or invalid '+
              'parameter'+(output.problems.length!==1?'s':'');
              var err = new Error(baseValidationErrMsg+':\n'+prettyPrintedValidationErrorsStr);
              err.code = 'E_MISSING_OR_INVALID_PARAMS';
              err.problems = output.problems;

              // Attach a toJSON function to the error.  This will be run automatically
              // when this error is being stringified.  This is our chance to make this
              // error easier to read/programatically parse from the client.
              err.toJSON = function (){
                // Include the error code and the array of RTTC validation errors
                // for easy programmatic parsing.
                var jsonReadyErrDictionary = _.pick(err, ['code', 'problems']);
                // And also include a more front-end-friendly version of the error message.
                var preamble =
                'The server could not fulfill this request (`'+req.method+' '+req.path+'`) '+
                'due to '+output.problems.length+' missing or invalid '+
                'parameter'+(output.problems.length!==1?'s':'')+'.';

                // If NOT running in production, then provide additional details and tips.
                if (!IS_RUNNING_IN_PRODUCTION) {
                  jsonReadyErrDictionary.message = preamble+'  '+
                  '**The following additional tip will not be shown in production**:  '+
                  'Tip: Check your client-side code to make sure that the request data it '+
                  'sends matches the expectations of the corresponding parameters in your '+
                  'server-side route/action.  Also check that your client-side code sends '+
                  'data for every required parameter.  Finally, for programmatically-parseable '+
                  'details about each validation error, `.problems`. ';
                }
                // If running in production, use a message that is more terse.
                else {
                  jsonReadyErrDictionary.message = preamble;
                }
                //>-

                return jsonReadyErrDictionary;

              };//</define :: err.toJSON()>


              // If `res.badRequest` exists, use that.
              if (_.isFunction(res.badRequest)) {
                return res.badRequest(err);
              }
              // Otherwise just send a 400 response with the error encoded as JSON.
              else {
                return res.status(400).json(err);
              }

            }//</if :: machine runtime validation error (E_INVALID_ARGINS)>


            // -•
            switch (responses[exitCodeName].responseType) {

              //  ┬─┐┌─┐┌─┐┌─┐┌─┐┌┐┌┌─┐┌─┐  ┌┬┐┬ ┬┌─┐┌─┐  ╔═╗╔╦╗╔═╗╔╗╔╔╦╗╔═╗╦═╗╔╦╗
              //  ├┬┘├┤ └─┐├─┘│ ││││└─┐├┤    │ └┬┘├─┘├┤   ╚═╗ ║ ╠═╣║║║ ║║╠═╣╠╦╝ ║║
              //  ┴└─└─┘└─┘┴  └─┘┘└┘└─┘└─┘   ┴  ┴ ┴  └─┘  ╚═╝ ╩ ╩ ╩╝╚╝═╩╝╩ ╩╩╚══╩╝
              case '': (function(){

                // var outputExample = getOutputExample({ machineDef: wetMachine.getDef(), exitCodeName: exitCodeName });

                // • Undefined output example:  We take that to mean void...mostly (see below.)
                // (But currently, we just treat it the same as if it is outputExample: '===')
                // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                // FUTURE: bring this back, but behind a flag:
                // (see https://github.com/sailshq/machine-as-action/pull/12/commits/adeae40aac1daa448401f40113a625c3f1980200 for more context)
                //
                // ```
                // var willNotTolerateOutput = false || _.isUndefined(outputExample);
                // if (willNotTolerateOutput) {

                //   // Expose a more specific varname for clarity.
                //   var unexpectedOutput = output;

                //   // Technically the machine `fn` could still send through data.
                //   // No matter what, we NEVER send that runtime data to the response.
                //   //
                //   // BUT we still log that data to the console using `sails.log.warn()` if available
                //   // (otherwise `console.warn()`).  We use an overridable log function to do this.
                //   if (!_.isUndefined(unexpectedOutput)) {

                //     try {
                //       // If provided, use custom implementation.
                //       if (!_.isUndefined(options.logDebugOutputFn)) {
                //         options.logDebugOutputFn(unexpectedOutput);
                //       }
                //       // Otherwise, use the default implementation:
                //       else {
                //         var logMsg = 'Received incoming request (`'+req.method+' '+req.path+'`) '+
                //                      'and ran action (`'+machineDef.identity+'`), which exited with '+
                //                      'its `'+exitCodeName+'` response and the following data:\n'+
                //                      util.inspect(unexpectedOutput, {depth: null})+
                //                      '\n'+
                //                      '(^^ this data was not sent in the response)';

                //         // Only log unexpected output in development.
                //         if (!IS_RUNNING_IN_PRODUCTION) {

                //           if (_.isObject(req._sails) && _.isObject(req._sails.log) && _.isFunction(req._sails.log.debug)) {
                //             req._sails.log.debug(logMsg);
                //           }
                //           else {
                //             console.warn(logMsg);
                //           }

                //         }//</if we're in development mode, log unexpected output>

                //       }//</default implementation to handle logging unexpected output>
                //     } catch (e) { console.warn('The configured log function for unexpected output (`logDebugOutputFn`) threw an error.  Proceeding to send response anyway...  Error details:',e); }
                //   }//</if there is unexpected output sent through callback within `fn` at runtime>

                //   // >-
                //   // Regardless of whether there's unexpected output or not...

                //   // Set the status code.
                //   res = res.status(responses[exitCodeName].statusCode);

                //   // And send the response.
                //   if (res.finished) {
                //     // If res.end() has already been called somehow, then this is definitely an error.
                //     // Currently, in this case, we handle this simply by trying to call res.send(),
                //     // deliberately causing the normal "headers were already sent" error.
                //     // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                //     // FUTURE: use a better, custom error here  (e.g. you seem to be trying to send
                //     // a response to this request more than once!  Note that the case of triggering
                //     // more than one exit, or the same exit more than once, is already handled w/ a
                //     // custom error msg elsewhere)
                //     // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                //     return res.send();
                //   }
                //   else if (res.headersSent) {
                //     // Calling `exits.success()` after having done res.write() calls
                //     // earlier (and thus sending headers) is fine-- as long as you
                //     // haven't done something that ended the response yet.
                //     //  We gracefully tolerate it here.
                //     return res.end();
                //   }
                //   else { return res.send(); }

                // }//</ outputExample is undefined > -•

                // ```
                // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

                // • Expecting ref:  (+ currently also if exit was left with no output declaration at all)


                if (res.finished) {
                  // If res.end() has already been called somehow, then this is definitely an error.
                  // Currently, in this case, we handle this simply by trying to call res.send(),
                  // deliberately causing the normal "headers were already sent" error.
                  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                  // FUTURE: use a better, custom error here  (e.g. you seem to be trying to send
                  // a response to this request more than once!  Note that the case of triggering
                  // more than one exit, or the same exit more than once, is already handled w/ a
                  // custom error msg elsewhere)
                  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                  return res.send();
                }
                else if (res.headersSent) {
                  // Calling `exits.success()` after having done res.write() calls
                  // earlier (and thus sending headers) is fine-- as long as you
                  // haven't done something that ended the response yet.
                  //  We gracefully tolerate it here.
                  return res.end();
                }

                // If `null`, use res.sendStatus().
                if (_.isUndefined(output) || _.isNull(output)) {
                  return res.sendStatus(responses[exitCodeName].statusCode);
                }
                // If the output is an Error instance and it doesn't have a custom .toJSON(),
                // then util.inspect() it instead (otherwise res.json() will turn it into an empty dictionary).
                // Note that we don't use the `stack`, since `res.badRequest()` might be used in production,
                // and we wouldn't want to inadvertently dump a stack trace.
                if (_.isError(output)) {

                  // Set the status code.
                  res = res.status(responses[exitCodeName].statusCode);

                  if (!_.isFunction(output.toJSON)) {
                    // Don't send the stack trace in the response in production.
                    if (IS_RUNNING_IN_PRODUCTION) {
                      return res.sendStatus(responses[exitCodeName].statusCode);
                    }
                    else {
                      // No need to JSON stringify (this is already a string).
                      return res.send(util.inspect(output));
                    }
                  }
                  else {
                    return res.json(output);
                  }
                }//-•

                // • Stream (hopefully a Readable one)
                if (output instanceof Stream) {
                  output.once('error', function (rawDownloadError){
                    try {
                      var err = flaverr({
                        message: 'Encountered error during file download:  '+rawDownloadError.message,
                        raw: rawDownloadError
                      }, rawDownloadError);

                      if (res.finished) {
                        return res.send();
                      }
                      else if (res.headersSent) {
                        return res.end();
                      }
                      else if (_.isFunction(res.serverError)) {
                        return res.serverError(err);
                      }
                      else {
                        // Log the error.
                        if (_.isObject(req._sails) && _.isObject(req._sails.log) && _.isFunction(req._sails.log.error)) {
                          req._sails.log.error(err);
                        }
                        else {
                          console.error(err);
                        }

                        // Don't send the error in the response in production.
                        if (IS_RUNNING_IN_PRODUCTION) {
                          return res.sendStatus(500);
                        }
                        // Otherwise, send the error message in the response.
                        else {
                          return res.status(500).send(util.inspect(err,{depth:null}));
                        }
                      }
                    } catch (err) { console.error('Consistency violation: Unexpected internal error:',err); }
                  });//æ

                  res.status(responses[exitCodeName].statusCode);
                  return output.pipe(res);
                }
                // • Buffer
                else if (output instanceof Buffer) {
                  res.status(responses[exitCodeName].statusCode);
                  return Streamifier.createReadStream(output).pipe(res);
                }
                // - else just continue on to our `res.send()` catch-all below


                // • Actual output is number:
                //
                // If this is a number, handle it as a special case to avoid tricking Express
                // into thinking it is a status code.
                if (_.isNumber(output)) {
                  return res.status(responses[exitCodeName].statusCode).json(output);
                }//-•


                // • Anything else:  (i.e. rttc.dehydrate())
                var dehydrated = rttc.dehydrate(output, true, undefined, undefined, true);
                                                       //^ allowNull
                                                       //      ^dontStringifyFunctions
                                                       //                 ^allowNaNAndFriends
                                                       //                             ^doRunToJSONMethods
                return res.status(responses[exitCodeName].statusCode).send(dehydrated);

              })(); return; //</case (w/ self-invoking function wrapper)>


              //  ┬─┐┌─┐┌─┐┌─┐┌─┐┌┐┌┌─┐┌─┐  ┌┬┐┬ ┬┌─┐┌─┐  ╦═╗╔═╗╔╦╗╦╦═╗╔═╗╔═╗╔╦╗
              //  ├┬┘├┤ └─┐├─┘│ ││││└─┐├┤    │ └┬┘├─┘├┤   ╠╦╝║╣  ║║║╠╦╝║╣ ║   ║
              //  ┴└─└─┘└─┘┴  └─┘┘└┘└─┘└─┘   ┴  ┴ ┴  └─┘  ╩╚═╚═╝═╩╝╩╩╚═╚═╝╚═╝ ╩
              case 'redirect': (function (){
                // If `res.redirect()` is missing, we have to complain.
                // (but if this is a Sails app and this is a Socket request, let the framework handle it)
                if (!_.isFunction(res.redirect) && !(req._sails && req.isSocket)) {
                  throw new Error('Cannot redirect this request because `res.redirect()` does not exist.  Is this an HTTP request to a conventional server (i.e. Sails.js/Express)?');
                }

                // Set status code.
                res = res.status(responses[exitCodeName].statusCode);

                if (_.isUndefined(output)) {
                  return res.redirect();
                }
                else {
                  return res.redirect(output);
                }

              })(); return;//</ case (in self-invoking function wrapper) >

              //  ┬─┐┌─┐┌─┐┌─┐┌─┐┌┐┌┌─┐┌─┐  ┌┬┐┬ ┬┌─┐┌─┐  ╦  ╦╦╔═╗╦ ╦
              //  ├┬┘├┤ └─┐├─┘│ ││││└─┐├┤    │ └┬┘├─┘├┤   ╚╗╔╝║║╣ ║║║
              //  ┴└─└─┘└─┘┴  └─┘┘└┘└─┘└─┘   ┴  ┴ ┴  └─┘   ╚╝ ╩╚═╝╚╩╝
              case 'view': (function (){
                // If `res.view()` is missing, we have to complain.
                // (but if this is a Sails app and this is a Socket request, let the framework handle it)
                if (!_.isFunction(res.view) && !(req._sails && req.isSocket)) {
                  throw new Error('Cannot render a view for this request because `res.view()` does not exist.  Are you sure this an HTTP request to a Sails.js server with the views hook enabled?');
                }

                // Set status code.
                res = res.status(responses[exitCodeName].statusCode);

                if (_.isUndefined(output) || _.isNull(output)) {
                  return res.view(responses[exitCodeName].viewTemplatePath);
                }
                else if (_.isObject(output) && !_.isArray(output) && !_.isFunction(output)) {
                  return res.view(responses[exitCodeName].viewTemplatePath, output);
                }
                else {
                  throw new Error(
                    'Cannot render a view for this request because the provided view locals data '+
                    '(the value passed in to `exits.'+exitCodeName+'()`) is not a dictionary.  '+
                    'In order to respond with a view, either send through a dictionary (e.g. '+
                    '`return exits.'+exitCodeName+'({foo: \'bar\'})`), or don\'t send through '+
                    'anything at all.  Here is what was passed in: '+util.inspect(output,{depth:null})
                  );
                }

              })(); return;//</ case (in self-invoking function wrapper) >



              //  ┬─┐┌─┐┌─┐┌─┐┌─┐┌┐┌┌─┐┌─┐  ┌┬┐┬ ┬┌─┐┌─┐  ╔═╗╦═╗╦═╗╔═╗╦═╗
              //  ├┬┘├┤ └─┐├─┘│ ││││└─┐├┤    │ └┬┘├─┘├┤   ║╣ ╠╦╝╠╦╝║ ║╠╦╝
              //  ┴└─└─┘└─┘┴  └─┘┘└┘└─┘└─┘   ┴  ┴ ┴  └─┘  ╚═╝╩╚═╩╚═╚═╝╩╚═
              case 'error': (function (){
                if (!_.isFunction(res.serverError)) {
                  throw new Error('Need `res.serverError()` to exist as a function in order to use the `error` response type.  Is this a Sails.js app with the responses hook enabled?');
                }//-•

                // Use our output as the argument to `res.serverError()`.
                var catchallErr = output;
                // ...unless there is NO output, in which case we build an error message explaining what happened and pass THAT in.
                if (_.isUndefined(output)) {
                  catchallErr = new Error(util.format('Action (triggered by a `%s` request to  `%s`) encountered an error, triggering its "%s" exit. No additional error data was provided.', req.method, req.path, exitCodeName) );
                }

                // If this is an internal error, adjust it so that it doesn't contain
                // the useless stack trace from inside machine-as-action.
                // (This is because MaA is a top-level runner.)
                if (catchallErr.code === 'E_INTERNAL_ERROR' && _.isError(catchallErr.raw)) {
                  catchallErr = flaverr({
                    name: 'Error',
                    code: 'E_INTERNAL_ERROR',
                    message: 'Internal error occurred while running this action:  '+catchallErr.raw.message
                  }, catchallErr.raw);
                }

                return res.serverError(catchallErr);

              })(); return;//</ case (in self-invoking function wrapper) >


              ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
              // Currently here strictly for backwards compatibility-
              // this response type may be removed (or more likely have its functionality tweaked) in a future release:
              case 'status':
                console.warn('The `status` response type will be deprecated in an upcoming release.  Please use `` (standard) instead.  Please use `` (standard) instead (i.e. remove `responseType` from the `'+exitCodeName+'` exit.)');
                return res.status(responses[exitCodeName].statusCode).send();
              ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

              ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
              // Currently here strictly for backwards compatibility-
              // this response type may be removed (or more likely have its functionality tweaked) in a future release:
              case 'json':
                console.warn('The `json` response type will be deprecated in an upcoming release.  Please use `` (standard) instead (i.e. remove `responseType` from the `'+exitCodeName+'` exit.)');
                return res.status(responses[exitCodeName].statusCode).json(output);
              ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


              //  ┬ ┬┌┐┌┬─┐┌─┐┌─┐┌─┐┌─┐┌┐┌┬┌─┐┌─┐┌┬┐  ┬─┐┌─┐┌─┐┌─┐┌─┐┌┐┌┌─┐┌─┐  ┌┬┐┬ ┬┌─┐┌─┐
              //  │ ││││├┬┘├┤ │  │ ││ ┬││││┌─┘├┤  ││  ├┬┘├┤ └─┐├─┘│ ││││└─┐├┤    │ └┬┘├─┘├┤
              //  └─┘┘└┘┴└─└─┘└─┘└─┘└─┘┘└┘┴└─┘└─┘─┴┘  ┴└─└─┘└─┘┴  └─┘┘└┘└─┘└─┘   ┴  ┴ ┴  └─┘
              default: (function(){

                var declaredResponseType = responses[exitCodeName].responseType;
                var supposedResponseMethod = res[declaredResponseType];

                if (_.isUndefined(supposedResponseMethod)) {
                  throw new Error('Attempting to use `res.'+declaredResponseType+'()`, but there is no such method.  Make sure you\'ve defined `api/responses/'+supposedResponseMethod+'.js`.');
                }//-•

                if (!_.isFunction(supposedResponseMethod)) {
                  throw new Error('Attempting to use `res.'+declaredResponseType+'()`, but it is invalid!  Instead of a function, `res.'+declaredResponseType+'` is: '+util.inspect(supposedResponseMethod,{depth:null}));
                }//-•

                // Otherwise, we recognized this as a (hopefully) usable method on `res`.

                // So first, set the status code.
                res = res.status(responses[exitCodeName].statusCode);

                // Handle special case of `null` output.
                // (Because, when preparing a standard response, we treat `null` as equivalent to undefined.)
                // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                // FUTURE: Potentially remove this.  See other "FUTURE" blocks in this file for more information/context.
                // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                if (_.isNull(output)) {
                  output = undefined;
                }

                // And then try calling the method.
                try {
                  supposedResponseMethod(output);
                } catch (e) { throw new Error('Tried to call `res.'+declaredResponseType+'('+(_.isUndefined(output)?'':'output')+')`, but it threw an error: '+(_.isError(e) ? e.stack : util.inspect(e,{depth:null}))); }

              })(); return; //</default (in self-invoking function wrapper)>

            }//</switch>--•
          } catch (e) {

            var errAsString;
            if (_.isError(e)) {
              errAsString = e.stack;
            }
            else {
              errAsString = util.inspect(e,{depth:null});
            }

            var errMsg =
            'Handled a `'+req.method+'` request to  `'+req.path+'`, by running an action, '+
            'which called its `'+exitCodeName+'` exit.  But then an error occurred: '+errAsString;

            // Log the error.
            if (_.isObject(req._sails) && _.isObject(req._sails.log) && _.isFunction(req._sails.log.error)) {
              req._sails.log.error(errMsg);
            }
            else {
              console.error(errMsg);
            }

            // Don't send the error in the response in production.
            if (IS_RUNNING_IN_PRODUCTION) {
              return res.sendStatus(500);
            }
            // Otherwise, send the error message in the response.
            else {
              return res.status(500).send(errMsg);
            }

          }
        });//</after: waitForSimulatedLatencyIfRelevant>

      };//</respondApropos>
    });//</each exit>

    // Then attach them and execute the machine.
    return deferred.switch(callbacks);

  };//ƒ </define action>

  // Set `IS_MACHINE_AS_ACTION` flag to prevent accidentally attempting to wrap the same thing twice.
  action.IS_MACHINE_AS_ACTION = true;

  // Attach toJSON method that exposes this action's definition.
  action.toJSON = function(){
    return wetMachine.toJSON();
  };//ƒ

  // Finally, return the action.
  return action;
};


