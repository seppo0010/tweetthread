require('dotenv').config()
const https = require('https')
const Twitter = require('twitter');
const LoginWithTwitter = require('login-with-twitter')
const express = require('express');
const app = express();

const twitterLogin = new LoginWithTwitter({
  consumerKey: process.env.TWITTER_API_KEY,
  consumerSecret: process.env.TWITTER_API_SECRET,
  callbackUrl: process.env.TWITTER_CALLBACK_URL,
})

app.use(express.json());
app.use(express.static('public'));

app.get("/", function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/add-twitter-account', (req, res) => {
  twitterLogin.login((err, tokenSecret, url) => {
    res.json({url, tokenSecret})
  })
})

app.post('/add-twitter-account-ready', (req, res) => {
  const {oauthToken, oauthVerifier, tokenSecret} = req.body;
  twitterLogin.callback({
    oauth_token: oauthToken,
    oauth_verifier: oauthVerifier
  }, tokenSecret, (err, user) => {
    if (err) {
      console.error(err);
      res.end(500)
      return
    }
    res.json(user)
  });
})

app.get('/twitter-callback', (req, res) => {
  return res.send(`<script>window.opener.callback(${JSON.stringify(req.query.oauth_token)}, ${JSON.stringify(req.query.oauth_verifier)})</script>`)
})

app.post('/tweet', function(req, res) {
  const {from, tweets} = req.body;
  const client = new Twitter({
    consumer_key: process.env.TWITTER_API_KEY,
    consumer_secret: process.env.TWITTER_API_SECRET,
    access_token_key: from.userToken,
    access_token_secret: from.userTokenSecret,
  });
  let lastReply = undefined;
  let tweetPos = 0;
  const uploadAttachment = (url, alt) => new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = [];

      res.on('data', function(chunk) {
        data.push(chunk);
      }).on('end', function() {
        let body = Buffer.concat(data);
        initUpload(body.length, res.headers['content-type'])
          .then((mediaId) => appendUpload(mediaId, body))
          .then(finalizeUpload)
          .then(mediaId => {
            /*
            if (alt) {
                client.post('media/metadata/create', {
                  media_id: mediaId,
                  alt_text: { text: alt },
                }).then(() => resolve(mediaId));
            } else {
            }*/
            resolve(mediaId)
          })
          .catch((err) => {
	    console.error('Failed to get attachment');
	    reject(err)
	  });
      });
    });
  })

  function initUpload(mediaSize, mediaType) {
    return makePost('media/upload', {
      command    : 'INIT',
      total_bytes: mediaSize,
      media_type : mediaType,
    }).then(data => data.media_id_string);
  }

  function appendUpload(mediaId, mediaData) {
    return makePost('media/upload', {
      command      : 'APPEND',
      media_id     : mediaId,
      media        : mediaData,
      segment_index: 0
  }).then(data => mediaId);
  }

  function finalizeUpload(mediaId) {
    return makePost('media/upload', {
      command : 'FINALIZE',
      media_id: mediaId
    }).then(data => mediaId);
  }
  
  function makePost (endpoint, params) {
    return new Promise((resolve, reject) => {
      client.post(endpoint, params, (error, data, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  const doTweet = function() {
    let text = tweets[tweetPos];
    const attachments = []
    while (true) {
      const m = text.match(/!\[(.*?)\]\((.*?)\)/, '')
      if (!m) break;
      attachments.push(uploadAttachment(m[2], m[1]));
      text = text.replace(/!\[.*?\]\(.*?\)/, '')
    }
    return Promise.all(attachments).then((media_ids) => {
      return client.post('statuses/update', {status: text, in_reply_to_status_id: lastReply, media_ids: media_ids.join(',')}).then(function(tweet) {
        lastReply = tweet.id_str;
      })
    }).catch((err) => {
      console.error(err);
      tweetPos = -2;
    })
  }

  const tweetNext = function() {
    tweetPos++;
    if (!tweets[tweetPos]) return;
    return doTweet().then(tweetNext)
  }
  doTweet(tweets[0]).then(tweetNext);
  res.end()
})

var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
