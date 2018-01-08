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


// helper function to parse Date objects in the format: Monday, Jan. 1st
function parseDate(date) {
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  var dates = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th',
  '16th', '17th', '18th', '19th', '20th', '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th', '29th', '30th', '31st'];

  var str = days[date.getDay()] + ', ' + months[date.getMonth()] + ' ' + dates[date.getDate() - 1];
  return str;
}



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
          var now = new Date();
          var subscriberObj = {
            user_id: tweet.user.id_str,
            username: tweet.user.screen_name,
            followers_count_start: tweet.user.followers_count,
            friends_count_start: tweet.user.friends_count,
            date_start: parseDate(now),
            filter_stream_refreshed: false,
            tweets_this_cycle: 0
          };

          console.log('Inserting new subscriber into collection');
          try {
            subscribers.insertOne(subscriberObj);
          } catch (e) {
            console.log('Insertion failed', e);
          }


          // Send welcome message
          console.log('Sending welcome message');
          var welcomeMsg = "Thanks for subscribing! You'll find a message in your inbox every Sunday at 10 a.m. PST with your previous week's tweet and follower stats! Note: your new tweets won't begin to get counted until the next weekly cycle.\n\nReply 'STOP' at any time to opt-out.";
          T.post('direct_messages/new', { user_id: tweet.user.id_str, text: welcomeMsg }, function(err, res) {
            if (err) {
              console.log('Message failed', err);
            }
          });

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

});  // end listener


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

});  // end listener



// ...... LISTEN FOR SUBSCRIBERS' TWEETS ......

// Set a 5s timeout to give enough time for the database to connect
setTimeout(getNumItems, 5000);


// Gets the number of subscribers in collection
function getNumItems() {
  if (!db) {
    console.log('Database not connected; cannot count tweets');
  } else {
  // Get # of documents in collection
  // Note that .count() returns a 'promise', which contains the count of items when resolved
  // (so it represents the eventual completion of an asynchronous operation)
  subscribers.count()
    .then(function(numItems) {
      console.log('Refreshing stream. There are', numItems, 'subscriber(s)');
      getUsersToFollow(numItems);
    })

  }

}


// Gets a comma-separated list of all subscribers' ids
function getUsersToFollow(n) {
  var usersToFollow = [];
  var j = 0;  // Counter
  if (n == 0) {
    countTweets(usersToFollow);
  } else {
    subscribers.find().forEach(function(doc) {
      usersToFollow.push(doc.user_id);
      j++;
      if (j == n) {
        countTweets(usersToFollow);
      }
    });
  }

}


function countTweets(followList) {
  // Initialize a filter stream
  var tweetCounter = T.stream('statuses/filter', { follow: followList });


  // Listen for tweets
  tweetCounter.on('tweet', function(tweet) {
    // console.log(tweet);


    // Double check tweet is from a subscriber
    subscribers.findOne({ user_id: tweet.user.id_str }, function(err, doc) {
      if (doc) {
        console.log('A tweet from @' + doc.username + ' just came in!');


        // Increment their tweet count
        console.log('Incrementing tweet count');
        try {
          subscribers.updateOne({ user_id: doc.user_id }, {
            $inc: { tweets_this_cycle: 1 }
          });
        } catch(e) {
          console.log('Update failed', e);
        }

      }
    });

  })  // end listener


  // Each week, disconnect the stream, update follow list, then reconnect
  // (only do once per week to minimize # of streams being opened by the bot)

  // For development:
  // var cronTimeValue = '*/30 * * * * *';  // Run every 30 seconds
  // var cronTimeValue = '00 * * * * *';  // Run every minute
  // var cronTimeValue = '00 50 18 23 * *';

  // For production:
  var cronTimeValue = '00 01 10 * * 0';  // Run every Sunday at 10:01:00 AM

  var refreshList = new cron.CronJob({
    cronTime: cronTimeValue,
    onTick: function() {
      tweetCounter.stop();  // Stop stream ASAP so Twitter doesn't ban us
      var now = new Date();
      console.log("Tick. It's " + parseDate(now) + ' at ' + now.getHours() + ':' + now.getMinutes());


      // Update db since stream is about to be refreshed
      subscribers.find().forEach(function(doc) {
        try {
          subscribers.updateOne({ user_id: doc.user_id }, {
            $set: { filter_stream_refreshed: true }
          });
        } catch(e) {
          console.log('Update failed', e);
        }
      });


      // Stop job so that the onComplete function fires
      refreshList.stop();

    },  // Fires at specified time
    onComplete: function() {
      console.log('Refreshing filter stream');
      getNumItems();
    },  // Fires when the job stops
    start: true,  // Start job right now
    timeZone: 'America/Los_Angeles'  // PST
  });

}  // end countTweets()



// ...... SEND WEEKLY STATS ......

// For development:
// var cronTimeValue = '*/6 * * * * *';  // Run every 10 seconds
// var cronTimeValue = '*/30 * * * * *';  // Run every 30 seconds
// var cronTimeValue = '00 * * * * *';  // Run every minute
// var cronTimeValue = '00 33 19 23 * *';

// For production:
var cronTimeValue = '00 00 10 * * 0';  // Run every Sunday at 10:00:00 AM

var directMessages = new cron.CronJob({
  cronTime: cronTimeValue,
  onTick: sendMessages,  // Function to fire at specified time
  start: true,  // Start job right now
  timeZone: 'America/Los_Angeles'  // PST
});


// Sends all subscribers their weekly twitter stats via direct message
// eg. # tweets made, # followers gained/lost, # friends gained/lost
function sendMessages() {
  var now = new Date();
  console.log("Tick. It's " + parseDate(now) + ' at ' + now.getHours() + ':' + now.getMinutes());


  // Iterate through all subscribers
  subscribers.find().forEach(function(doc) {
    // Get their current # of followers and friends
    T.get('users/lookup', { user_id: doc.user_id }, function(err, data, response) {
      if (err) {
        console.log('Lookup failed');
      } else {
        var followersCountEnd = data[0].followers_count,
            friendsCountEnd = data[0].friends_count;


        // Create message
        var msg, tweetMsg, followMsg, friendMsg;

        tweetMsg = '\u2B06\uFE0E  ' + doc.tweets_this_cycle + ' new tweet';
        if (doc.tweets_this_cycle != 1) {
          tweetMsg += 's\n';
        } else {
          tweetMsg += '\n';
        }

        if (followersCountEnd - doc.followers_count_start >= 0) {
          followMsg = '\u2B06\uFE0E  ' + (followersCountEnd - doc.followers_count_start) + ' more follower';
          if (followersCountEnd - doc.followers_count_start != 1) {
            followMsg += 's\n';
          } else {
            followMsg += '\n';
          }
        } else {
          followMsg = '\u2B07\uFE0E  ' + (doc.followers_count_start - followersCountEnd) + ' fewer follower';
          if (doc.followers_count_start - followersCountEnd != 1) {
            followMsg += 's\n';
          } else {
            followMsg += '\n';
          }
        }

        if (friendsCountEnd - doc.friends_count_start >= 0) {
          friendMsg = '\u2B06\uFE0E  ' + (friendsCountEnd - doc.friends_count_start) + ' more following\n';
        } else {
          friendMsg = '\u2B07\uFE0E  ' + (doc.friends_count_start - friendsCountEnd) + ' fewer following\n';
        }

        var now = new Date();

        msg = 'These are your weekly Twitter stats.\n\n' + doc.date_start + ' to ' + parseDate(now) + ':\n';
        if (doc.filter_stream_refreshed) {
          msg += tweetMsg;
        }
        msg += followMsg + friendMsg;


        // Send the message
        console.log('Sending direct message to @' + doc.username);
        T.post('direct_messages/new', { user_id: doc.user_id, text: msg }, function(err, res) {
          if (err) {
            console.log('Message failed', err);
          }
        });


        // Update the db with current information
        try {
          subscribers.updateOne({ user_id: doc.user_id }, {
            $set: { followers_count_start: followersCountEnd, friends_count_start: friendsCountEnd, date_start: parseDate(now), tweets_this_cycle: 0 }
          });
        } catch(e) {
          console.log('Update failed', e);
        }

      }

    });  // end twitter lookup

  });  // end database call

}  // end sendMessages()
