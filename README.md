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

  traditionalReqRes: function (req, res) { /* ... */ },

  getLatest: asAction(OpenWeather.getCurrentConditions),

  doSomethingCustom: asAction({
    exits: {
      success: {
        outputExample: 'Some dynamic message like this.'
      }
    },
    fn: function (inputs, exits) {
      return exits.success('Hello world!');
    }
  }),

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

So sending down data is great, but sometimes you need to render view templates, redirect to dynamic URLs, use a special status code, stream down a file, etc.  No problem.  You can customize the response from each exit using a number of additional,  machine-as-action specific options.


```js
var asAction = require('machine-as-action');

// WeatherController.js
module.exports = {

  showHomepage: asAction({
    

    exits: {

      success:{
        responseType: 'view',
        viewTemplatePath: 'homepage'
        // The view will be provided with a "local" called `stuff`,
      }

    },


    fn: function(inputs,exits){
      return exits.success({ stuff: 'things' });
    }
    

  })
};
```


For each of your exits, you can optionally specify a `responseType`, `status`, and/or `view`.

**responseType** is one of the following:
 + ""         (the standard response:  Determine an appropriate response based on context: this might send plain text, download a file, transmit data as JSON, or send no response body at all.)
 + "view"     (render and respond with a view; exit output will be provided as view locals)
 + "redirect" (redirect to the URL returned as the exit output)
 
 <!-- + "error"    (use `res.serverError()` to send the appropriate default error response, such as an error page or a JSON message with a 500 status code.  Uses your project's configured responses from `api/responses/`, if applicable.) -->

**statusCode** is the status code to respond with.  (This works just like [status codes in Sails/Node](http://sailsjs.org/documentation/reference/response-res/res-status)).

**viewTemplatePath** is the relative path (from the `views/` directory) of the view to render.  It is only relevant if `responseType` is set to "view". (This works just like [views in Sails/Express](http://sailsjs.org/documentation/concepts/views)).
 
> If any of the above are not set explicitly, they will fall back to reasonable defaults (based on available information).
> 
> For example, if a non-success exit is set up to serve a view, then it will use the 200 response code.
> But if a non-success exit has no explicit response type configured (meaning it will respond with plain text,
> JSON-encoded data, or with no data and just a status code), then machine-as-action will default to using
> the 500 status code.  Similarly, in the same same scenario, but with `responseType: 'redirect'`, the status
> code will default to 302.  The success exit always has a default status code of 200, unless it is also
> `responseType: 'redirect'` (in which case it defaults to 302.)




#### File uploads

You can use the special `files` option to map a file parameter containing an incoming Skipper upstream to a machine input:


```js
var asAction = require('machine-as-action');

// WeatherController.js
module.exports = {


  uploadPhoto: asAction({
    

    files: ['photo']
    

    inputs: {

      photo: {
        example: '===',
        required: true
      }

    },


    fn: function (inputs, exits){
      inputs.photo.upload(function (err, uploadedFiles){
        if (err) return exits.error(err);
        exits.success();
      });
    }


  })


};
```


## Available Options

Aside from the [normal properties that go into a Node Machine definition](http://node-machine.org/spec), the following additional options are supported:

| Option                     | Type            | Description                                            |
|:---------------------------|-----------------|:-------------------------------------------------------|
| `files`                    | ((array?))      | An array of input code names identifying inputs which expect to receive file uploads instead of text parameters. These file inputs must have `example: '==='`, but they needn't necessarily be `required`.
| `urlWildcardSuffix`        | ((string?))     | If this action is handling a route with a wildcard suffix (e.g. `/foo/bar/*`), then specify this option as the code name of the machine input which should receive the string at runtime (i.e. the actual value of the "*" in the request URL).
| `disableDevelopmentHeaders`| ((boolean?))    | If set, then do not automatically set headers w/ exit info during development.
| `disableXExitHeader`       | ((boolean?))    | If set, then do not automatically send the `X-Exit` response header for any exit, regardless of whether this is a prod or dev environment.
| `simulateLatency`          | ((number?))     | If set, then simulate a latency of the specified number of milliseconds (e.g. 500)
| `logDebugOutputFn`    | ((function?))   | An optional override function to call when any output other than `undefined` is received from a void exit (i.e. an exit w/ no outputExample).  By default, machine-as-action uses `sails.log.warn()` if available, or `console.warn()` otherwise.

> ##### NOTE
>
> + For **more details** on any of these options, see https://github.com/treelinehq/machine-as-action/blob/02ae23ef1d052dfe7fa6139ac14516c83c12fe1b/index.js#L30.
> + Any of the options above should be provided as **top-level properties** of the `options` dictionary.
> + `machine-as-action` also supports **response directives** that can be provided as additional properties within nested exit definitions.  They are `responseType`, `statusCode`, and `viewTemplatePath`.  See examples above for more information.


## Extended example

This is a more detailed example, based on the simple intro example at the top of this README.

```js
var asAction = require('machine-as-action');
var OpenWeather = require('machinepack-openweather');

// WeatherController.js
module.exports = {

  traditionalReqRes: function (req, res) { /* ... */ },

  getLatest: asAction(OpenWeather.getCurrentConditions),

  doSomethingCustom: asAction({
    description: 'Send a plaintext response.',
    exits: {
      success: {
        outputExample: 'Some dynamic message like this.'
      }
    },
    fn: function (inputs, exits) {
      return exits.success('Hello world!');
    }
  }),

  getForecastData: asAction({
    description: 'Fetch data for the forecast with the specified id.',
    inputs: {
      id: { required: true, example: 325 }
    },
    exits: {
      success: {
        outputExample: {
          weatherPerson: 'Joaquin',
          days: [
            { tempCelsius: 21, windSpeedMph: 392 }
          ]
        }
      },
      notFound: {
        description: 'Could not find forecast with that id.',
        statusCode: 404
      }
    },
    fn: function (inputs, exits) {
      Forecast.find({ id: inputs.id }).exec(function (err, forecastRecord) {
        if (err) { return exits.error(err); }
        if (!forecastRecord) { return exits.notFound(); }
        return exits.success(forecastRecord);
      });
    }
  }),

  show7DayForecast: asAction({
    description: 'Show the current 7 day forecast page.',
    exits: {
      success: {
        responseType: 'view',
        viewTemplatePath: 'pages/weather/7-day-forecast'
      }
    },
    fn: function (inputs, exits) {
      return exits.success('http://sailsjs.org');
    }
  }),

  redirectToExternalForecastMaybe: asAction({
    description: 'Redirect the requesting user agent to http://weather.com, or to http://omfgdogs.com.',
    exits: {
      success: { responseType: 'redirect' }
    },
    fn: function (inputs, exits) {
      if (Math.random() > 0.5) {
        return exits.success('http://weather.com');
      }
      else {
        return exits.success('http://omfgdogs.com');
      }
    }
  })

};

```



## Bugs &nbsp; [![NPM version](https://badge.fury.io/js/machine-as-action.svg)](http://npmjs.com/package/machine-as-action)

To report a bug, [click here](http://sailsjs.com/bugs).


## Contributing &nbsp; [![Build Status](https://travis-ci.org/treelinehq/machine-as-action.svg?branch=master)](https://travis-ci.org/treelinehq/machine-as-action)

Please observe the guidelines and conventions laid out in the [Sails project contribution guide](http://sailsjs.com/documentation/contributing) when opening issues or submitting pull requests.

[![NPM](https://nodei.co/npm/machine-as-action.png?downloads=true)](http://npmjs.com/package/machine-as-action)


## License

MIT &copy; 2015-2016 Mike McNeil

_Incorporated as a core part of the Sails framework in 2016._

The [Sails framework](http://sailsjs.com) is free and open-source under the [MIT License](http://sailsjs.com/license).
