var Twit = require('twit');  // import the twit package

// load in api keys from config.js and create a new Twit object using the keys
// (this will be our connection to the Twitter api via the twit package)
var config = require('./config.js');
var T = new Twit(config);

// initialize a user stream (eg. for all activities related to my account)
var stream = T.stream('user');

// listen for new tweets
stream.on('tweet', function(tweet) {
  console.log(tweet);

  // filter stream by tweets to me, containing '#subscribe'
  if (tweet.in_reply_to_screen_name == 'give_me_stats' && tweet.text.indexOf('#subscribe') !== -1) {
    // tweet a thank-you reply
    T.post('statuses/update', { status: '@' + tweet.user.screen_name + ' Thank you for subscribing!', in_reply_to_status_id: tweet.id_str },
    function(err, data, response) {
    })
  }
});
