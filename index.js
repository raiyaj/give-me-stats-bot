// load environment variables from .env into process.env
require('dotenv').config();

// import the twit package
var Twit = require('twit');

// create a new Twit object using the api keys inside environment variables
// (this authenticates me using Oauth and will be our connection to the Twitter api via the twit package)
var T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

// initialize a public stream and filter by my screen name
var stream = T.stream('statuses/filter', { track: '@give_me_stats' });

// listen for new tweets
stream.on('tweet', function(tweet) {
  console.log(tweet);

  // check if tweet uses the #subscribe hashtag
  var tags = Object.keys(tweet.entities.hashtags);
  var subscribes = false;
  for (var i = 0; i < tags.length; i++) {
    if (tweet.entities.hashtags[tags[i]].text.toLowerCase() == 'subscribe') {
      subscribes = true;
    }
  }

  // filter stream by tweets to me, from users requesting to subscribe
  if (tweet.in_reply_to_screen_name == 'give_me_stats' && subscribes) {
    // tweet a thank-you reply
    T.post('statuses/update', { status: '@' + tweet.user.screen_name + ' Thank you for subscribing!',
    in_reply_to_status_id: tweet.id_str }, function(err, data, response) {
      console.log(err);
    });
  }
});
