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



## Customizing the response

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
 + status   (just status code, no response body, exit output will be ignored)
 + json     (exit output will be send down as a JSON-formatted response body)
 + view     (render and respond with a view; exit output will be provided as view locals)
 + redirect (redirect to the URL returned as the exit output)
 + error    (use `res.negotiate()` to send the appropriate default error response based on the exit output)

**status** is the status code to respond with.

**view** is the relative path (from the `views/` directory) of the view to render.  It is only relevant if `responseType` is set to "view".
 
If any of the above are not set explicitly, they will fall back to reasonable defaults.




## File uploads

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
          example: '*',
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


## License

MIT &copy; Mike McNeil
