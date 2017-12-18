var Twit = require('twit');  // import the twit package

// load in api keys from config.js and create a new Twit object using the keys
// (this will be our connection to the Twitter api via the twit package)
var config = require('./config.js');
var T = new Twit(config);

// initialize a user stream (eg. for all activities related to my account)
// set tweet mode so that the entities object is populated
var stream = T.stream('user', { tweet_mode: 'extended' });

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
