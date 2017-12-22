// Import packages
var Twit = require('twit'),
    mongo = require('mongodb'),
    dotenv = require('dotenv'),
    cron = require('cron');


// Load environment variables from .env into process.env
dotenv.config();


// Get the bot's twitter handle
var twitterHandle = process.env.TWITTER_HANDLE;


// Create a new Twit object using the api keys
// (this authenticates me using Oauth and will be our connection to the Twitter api via the twit package)
var T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});


// Create database & collection variables outside of the database connection callback to reuse the connection pool
var db, subscribers;

// Connect to the database
var dbURL = process.env.MONGODB_URI;
mongo.MongoClient.connect(dbURL, function(err, client) {
  if (err) {
    console.log('Failed to connect to database', err);
    process.exitCode = 1;  // Failure
  } else {
    // Save database object from the callback for reuse
    db = client.db(process.env.MONGODB_DATABASE_NAME);
    console.log('Database connection ready');

    // Create a 'subscribers' collection if it doesn't already exist
    subscribers = db.collection('subscribers');
  }
});



// ...... LISTEN FOR MY INCOMING TWEETS & MESSAGES ......

// Initialize a user stream
// (set tweet mode so that the entities object is populated)
var userStream = T.stream('user', { tweet_mode: 'extended' });


// Listen for tweets
userStream.on('tweet', function(tweet) {
  // console.log(tweet);


  // Filter stream by the bot's mentions
  if (tweet.in_reply_to_screen_name == twitterHandle) {
    console.log("A tweet just came in! This is it: '" + tweet.text + "'");


    // Check if tweet uses the #subscribe or #stop hashtags
    var tags = Object.keys(tweet.entities.hashtags);
    var subscribes = false, unsubscribes = false;
    var i = 0;
    while (i < tags.length && !subscribes && !unsubscribes) {
      if (tweet.entities.hashtags[tags[i]].text.toLowerCase() == 'stop') {
        unsubscribes = true;
      } else if (tweet.entities.hashtags[tags[i]].text.toLowerCase() == 'subscribe') {
        // Note: if both hashtags are used, #stop takes precedence
        subscribes = true;
      }
      i++;
    }


    // Process new subscriptions
    if (subscribes) {
      console.log('The tweet uses #subscribe');


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

          console.log('Inserting new subscriber into collection');
          try {
            subscribers.insertOne(subscriberObj);
          } catch (e) {
            console.log('Insertion failed', e);
          }

        }

      });

    }  // end processing #subscribe


    // Process opt-outs
    else if (unsubscribes) {
      console.log('The tweet uses #stop');


      // Drop subscriber from collection
      console.log('Removing subscriber from collection');
      try {
        subscribers.deleteOne({ user_id: tweet.user.id_str }, function(err, res) {
          if (res.deletedCount == 0) {
            console.log('User not found in database; nothing to delete');
          }
        });
      } catch (e) {
        console.log('Deletion failed', e);
      }

    }  // end processing #stop


    else {
      console.log("The tweet uses neither #subscribe nor #stop");
    }

  }

});  // end filter stream


// Listen for direct messages
userStream.on('direct_message', function(message) {
  // console.log(message);


  // Filter stream by messages sent to the bot
  if (message.direct_message.recipient.screen_name == twitterHandle) {
    console.log("A direct message just came in! This is it: '" + message.direct_message.text + "'");


    // Check if content of message is 'STOP'
    if (message.direct_message.text.toUpperCase() == 'STOP') {
      console.log("The message is 'STOP'");


      // Drop subscriber from collection
      console.log('Removing subscriber from collection');
      try {
        subscribers.deleteOne({ user_id: message.direct_message.sender.id_str }, function(err, res) {
          if (res.deletedCount == 0) {
            console.log('User not found in database; nothing to delete');
          }
        });
      } catch (e) {
        console.log('Deletion failed', e);
      }

    }

    else {
      console.log("The message is not 'STOP'");
    }

  }

});  // end direct message listener



// ...... SEND WEEKLY STATS ......

// Schedule regular times at which to send messages

// For development:
// var cronTimeValue = '*/6 * * * * *';  // Run every 10 seconds
var cronTimeValue = '*/30 * * * * *';  // Run every 30 seconds
// var cronTimeValue = '00 * * * * *';  // Run every minute

// For production:
// var cronTimeValue = '00 00 08 * * 0';  // Run every Sunday at 8:00:00 AM

var job = new cron.CronJob({
  cronTime: cronTimeValue,
  onTick: sendMessages,  // Function to fire at specified time
  start: true,  // Start job right now
  timeZone: 'America/Los_Angeles'  // PST
});


// Sends all subscribers their weekly twitter stats via direct message
// eg. # tweets made, # followers gained/lost, # friends gained/lost
function sendMessages() {
  console.log('Tick');


  // Iterate through all subscribers
  subscribers.find().forEach(function(doc) {
    // Get their current # of followers and friends
    console.log("Looking up user's current stats");
    T.get('users/lookup', { user_id: doc.user_id }, function(err, data, response) {
      if (err) {
        console.log('Lookup failed');
      } else {
        var followersCountEnd = data[0].followers_count,
            friendsCountEnd = data[0].friends_count;


        // Create message
        var msg, tweetMsg, followMsg, friendMsg;
        if (followersCountEnd - doc.followers_count_start >= 0) {
          followMsg = '\u2B06\uFE0E  ' + (followersCountEnd - doc.followers_count_start) + ' more followers\n';
        } else {
          followMsg = '\u2B07\uFE0E  ' + (doc.followers_count_start - followersCountEnd) + ' fewer followers\n';
        }
        if (friendsCountEnd - doc.friends_count_start >= 0) {
          friendMsg = '\u2B06\uFE0E  ' + (friendsCountEnd - doc.friends_count_start) + ' more following\n';
        } else {
          friendMsg = '\u2B07\uFE0E  ' + (doc.friends_count_start - friendsCountEnd) + ' fewer following\n';
        }

        msg = 'These are your weekly Twitter stats:\n\n' + followMsg + friendMsg;


        // Send the message
        console.log('Sending direct message');
        T.post('direct_messages/new', { user_id: doc.user_id, text: msg }, function(err, res) {
          if (err) {
            console.log('Message failed', err);
          }
        });


        // Update the db with current follower and friend counts
        console.log('Updating database with new stats');
        try {
          subscribers.updateOne({ user_id: doc.user_id }, {
            $set: { followers_count_start: followersCountEnd, friends_count_start: friendsCountEnd }
          });
        } catch(e) {
          console.log('Update failed', e);
        }

      }

    });  // end twitter lookup

  });  // end database call

}  // end sendMessages()
