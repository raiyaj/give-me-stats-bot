var Twit = require('twit');  // import the twit package

// load in api keys from config.js and create a new Twit object using the keys
// (this will be our connection to the Twitter api via the twit package)
var config = require('./config.js');
var T = new Twit(config);
