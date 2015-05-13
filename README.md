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





## Passing file uploads to a machine

You can use the special `files` option to map a file parameter containing an incoming Skipper upstream to a machine input:


```js
var asAction = require('machine-as-action');

// WeatherController.js
module.exports = {

  uploadPhoto: require('machine-as-action')({
    files: ['avatar']
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
