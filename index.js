// Import packages
var Twit = require('twit'),
    mongo = require('mongodb'),
    dotenv = require('dotenv');


// Load environment variables from .env into process.env
dotenv.config();


// Create a new Twit object using the api keys
// (this authenticates me using Oauth and will be our connection to the Twitter api via the twit package)
var T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});


// Create a database variable outside of the database connection callback to reuse the connection pool
var db;

// Connect to the database
var dbURL = process.env.MONGODB_URI;
mongo.MongoClient.connect(dbURL, function(err, client) {
  if (err) {
    console.log('Failed to connect to database', err);
    process.exitCode = 1;  // Failure
  } else {
    // Save database object from the callback for reuse
    db = client.db('give-me-stats-bot');
    console.log('Database connection ready');
  }
});


// Initialize a public stream and filter by my screen name
var stream = T.stream('statuses/filter', { track: '@give_me_stats' });

// Listen for new tweets
stream.on('tweet', function(tweet) {
  // console.log(tweet);
  console.log("A tweet just came in! This is it: '" + tweet.text + "'");


  // Check if tweet uses the #subscribe hashtag
  var tags = Object.keys(tweet.entities.hashtags);
  var subscribes = false;
  for (var i = 0; i < tags.length; i++) {
    if (tweet.entities.hashtags[tags[i]].text.toLowerCase() == 'subscribe') {
      subscribes = true;
    }
  }


  // Filter stream by tweets to me, from users requesting to subscribe
  if (tweet.in_reply_to_screen_name == 'give_me_stats' && subscribes) {
    console.log('The tweet uses the hashtag #subscribe');


    // Create a 'subscribers' collection if it doesn't already exist
    var subscribers = db.collection('subscribers');


    // Check if user is already a subscriber
    subscribers.findOne({ user_id: tweet.user.id_str }, function(err, doc) {
      if (doc) {
        console.log('User is already a subscriber');


        // Tweet an acknowledgement reply
        console.log('Tweeting an acknowledgement reply');
        T.post('statuses/update', { status: '@' + tweet.user.screen_name + " Thanks for tweeting me - you're already a subscriber.",
        in_reply_to_status_id: tweet.id_str }, function(err, data, response) {
          if (err) {
            console.log('Tweeting failed', err);
          }
        });


      } else {
        console.log('User is a new subscriber');


        // Tweet a thank-you reply
        console.log('Tweeting a thank-you reply');
        T.post('statuses/update', { status: '@' + tweet.user.screen_name + ' Thanks for subscribing!',
        in_reply_to_status_id: tweet.id_str }, function(err, data, response) {
          if (err) {
            console.log('Tweeting failed', err);
          }
        });


        // Insert new subscriber into collection
        var subscriberObj = {
          user_id: tweet.user.id_str,
          followers_count_start: tweet.user.followers_count,
          friends_count_start: tweet.user.friends_count,
          tweets_this_week: 0
        };

        subscribers.insertOne(subscriberObj, function(err, res) {
          if (err) {
            console.log('Failed to add subscriber', err);
          } else {
            console.log('New subscriber inserted into collection');
          }
        });

      }

    });

  }

});
