# Give Me Stats bot

<img src="logo.png" alt="logo" width="300">

Using the [Twitter Streaming API](https://developer.twitter.com/en/docs/tweets/filter-realtime/overview), this bot listens for new subscribers who tweet [@give_me_stats](https://twitter.com/give_me_stats) with _#subscribe_, then begins to count their new tweets as they come in and sends them regular direct messages with their previous week's tweet and follower stats.

## Setup

__Twitter__

Login to your [Twitter](https://twitter.com/) account (the bot will tweet from this account, so you may want to create a new one). Create an `.env` file and add your twitter handle (lowercase, without the '@'):
```
TWITTER_HANDLE=<your_twitter_handle>
```

[Create a new app](https://apps.twitter.com/app/new). Under the _Keys and Access Tokens_ tab, you'll find your _Consumer Key_ and _Consumer Secret_. Modify the app's permission level to _Read, write and direct messages_, then re-generate them and scroll down to generate your access tokens. Add all four keys your `.env` file:
```
TWITTER_CONSUMER_KEY=<YOUR_CONSUMER_KEY>
TWITTER_CONSUMER_SECRET=<YOUR_CONSUMER_SECRET>
TWITTER_ACCESS_TOKEN=<YOUR_ACCESS_TOKEN>
TWITTER_ACCESS_TOKEN_SECRET=<YOUR_ACCESS_TOKEN_SECRET>
```

__mLab__

Login to your (free) [mLab](https://mlab.com/) account. [Create a new MongoDB Deployment](https://mlab.com/create/wizard#PlanType-Provider), using _Amazon Web Services_ as your cloud provider and _Sandbox_ as your plan type. Select the AWS region closest to you.

Add a user to your new database under the _Users_ tab, with _read-only_ set to _false_. At the top of the page is a link to connect via the MongoDB URI: `mongodb://<dbuser>:<dbpassword>@ds...`. Add this to your `.env` file (inserting the username and password of the user you just created), along with the name of your database:
```
MONGODB_DATABASE_NAME=<your_database_name>
MONGODB_URI=<your_mongodb_uri>
```

__Then, install dependencies and start the bot:__
```
$ npm install
$ npm start
```
