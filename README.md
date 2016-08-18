# machine-as-action

Build a modified version of a machine that proxies its inputs from request parameters, and proxies its exits through the response.

```sh
$ npm install machine-as-action --save
```


## Usage

```js
var asAction = require('machine-as-action');
var OpenWeather = require('machinepack-openweather');

// WeatherController.js
module.exports = {

  getLatest: asAction(OpenWeather.getCurrentConditions),

  somethingCustom: function (req, res) { /* ... */ },

  // etc...
}
```

Now you can run your machine using a HTTP or Socket.io request:

```js
// For example, using jQuery and an out-of-the-box Sails.js route/blueprint configuration:
$.get('/weather/getLatest', {
  city: 'San Francisco'
}, function (weatherData){
  console.log(weatherData);
});
```

> Note that the machine definition you provide here doesn't have to come from an already-published machinepack-- it can be required locally from your project, or declared inline.



#### Customizing the response

So sending down data is great, but sometimes you need to render view templates, redirect to dynamic URLs, use a special status code, stream down a file, etc.  No problem.  You can customize the response from each exit using the `responses` option:

```js
var asAction = require('machine-as-action');

// WeatherController.js
module.exports = {

  showHomepage: asAction({
    machine: {
      exits: {
        success:{
          example: {
            stuff: 'some string'
          }
        }
      },
      fn: function(inputs,exits){return exits.success({stuff: 'things'});}
    },
    responses: {
      success: {
        responseType: 'view',
        view: 'homepage'
        // The view will be provided with a "local" called `stuff`
      }
    }
  })
};
```


For each of your exits, you can optionally specify a `responseType`, `status`, and/or `view`.

**responseType** is one of the following:
 + ""         (the standard response:  Determine an appropriate response based on context: this might send plain text, download a file, transmit data as JSON, or send no response body at all.)
 + "view"     (render and respond with a view; exit output will be provided as view locals)
 + "redirect" (redirect to the URL returned as the exit output)
 + "error"    (use `res.serverError()` to send the appropriate default error response, such as an error page or a JSON message with a 500 status code.  Uses your project's configured responses from `api/responses/`, if applicable.)

**statusCode** is the status code to respond with.  (This works just like [status codes in Sails/Node](http://sailsjs.org/documentation/reference/response-res/res-status)).

**viewTemplatePath** is the relative path (from the `views/` directory) of the view to render.  It is only relevant if `responseType` is set to "view". (This works just like [views in Sails/Express](http://sailsjs.org/documentation/concepts/views)).
 
If any of the above are not set explicitly, they will fall back to reasonable defaults.




#### File uploads

You can use the special `files` option to map a file parameter containing an incoming Skipper upstream to a machine input:


```js
var asAction = require('machine-as-action');

// WeatherController.js
module.exports = {

  uploadPhoto: asAction({
    files: ['photo']
    machine: {
      inputs: {
        photo: {
          example: '===',
          required: true
        }
      },
      exits: {success: {}},
      fn: function (inputs, exits){
        inputs.photo.upload(function (err, uploadedFiles){
          if (err) return exits.error(err);
          exits.success();
        });
      }
    },
  })

};
```


## Available Options

Aside from the [normal properties that go into a Node Machine definition](http://node-machine.org/spec), the following additional options are supported:

| Option                     | Type            | Description                                            |
|:---------------------------|-----------------|:-------------------------------------------------------|
| `machine`                  | ((dictionary?)) | If specified, `machine-as-action` will use this as the machine definition.  Otherwise by default, it expects the machine definition to be passed in at the top-level. In that case, the non-standard (`machine-as-action`-specific) options are omitted when the machine is built).
| `files`                    | ((array?))      | An array of input code names identifying inputs which expect to receive file uploads instead of text parameters. These file inputs must have `example: '==='`, but they needn't necessarily be `required`.
| `urlWildcardSuffix`        | ((string?))     | If this action is handling a route with a wildcard suffix (e.g. `/foo/bar/*`), then specify this option as the code name of the machine input which should receive the runtime value of `*`.
| `disableDevelopmentHeaders`| ((boolean?))    | If set, then do not automatically set headers w/ exit info during development.
| `disableXExitHeader`       | ((boolean?))    | If set, then do not automatically send the `X-Exit` response header for any exit, regardless of whether this is a prod or dev environment.
| `simulateLatency`          | ((number?))     | If set, then simulate a latency of the specified number of milliseconds (e.g. 500)
| `logUnexpectedOutputFn`    | ((function?))   | An optional override function to call when any output other than `undefined` is received from a void exit (i.e. an exit w/ no outputExample).  By default, machine-as-action uses `sails.log.warn()` if available, or `console.warn()` otherwise.

> ##### NOTE
>
> + For **more details** on any of these options, see https://github.com/treelinehq/machine-as-action/blob/02ae23ef1d052dfe7fa6139ac14516c83c12fe1b/index.js#L30.
> + Any of the options above should be provided as **top-level properties** of the `options` dictionary.
> + `machine-as-action` also supports **response directives** that can be provided as additional properties within nested exit definitions.  They are `responseType`, `statusCode`, and `viewTemplatePath`.  See examples above for more information.


## License

MIT &copy; Mike McNeil
