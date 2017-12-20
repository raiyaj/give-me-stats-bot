# Give me stats bot

### Setup

__Twitter__

Login to your [Twitter](https://twitter.com/) account (the bot will tweet from this account, so you may want to create a new one). Modify `config.js` with your twitter handle (without the '@'):
```
module.exports = {
  twitter_handle: '<your_twitter_handle>'
};
```

[Create a new app](https://apps.twitter.com/app/new). Under the _Keys and Access Tokens_ tab, you'll find your _Consumer Key_ and _Consumer Secret_. Scroll down and click 'Create my access token' to generate your _Access Token_ and _Access Token Secret_. Create an `.env` file and copy in all four keys:
```
TWITTER_CONSUMER_KEY=<YOUR_CONSUMER_KEY>
TWITTER_CONSUMER_SECRET=<YOUR_CONSUMER_SECRET>
TWITTER_ACCESS_TOKEN=<YOUR_ACCESS_TOKEN>
TWITTER_ACCESS_TOKEN_SECRET=<YOUR_ACCESS_TOKEN_SECRET>
```

__mLab__

Login to your (free) [mLab](https://mlab.com/) account. [Create a new MongoDB Deployment](https://mlab.com/create/wizard#PlanType-Provider), using _Amazon Web Services_ as your cloud provider and _Sandbox_ as your plan type. Select the AWS region closest to you.

Click on your new deployment and create a new database user under the _Users_ tab, with _read_only_ set to _false_. At the top of the page, you'll see a link to connect to the database server via the standard MongoDB URI, like so: `mongodb://<dbuser>:<dbpassword>@ds...`. Add this to your `.env` file, inserting the username and password of the user you just created:
```
MONGODB_URI=<your_mongodb_uri>
```

__Then, install dependencies and start the bot:__
```
$ npm install
$ npm start
```
