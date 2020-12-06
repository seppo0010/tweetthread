/* global TrelloPowerUp */

var Promise = TrelloPowerUp.Promise;

var TWITTER_ICON = 'https://tweetthread.seppo.com.ar/iconbw.png';

TrelloPowerUp.initialize({
    'card-buttons': function(t, options) {
         return [{
             icon: TWITTER_ICON,
             text: 'Tweet',
             callback: function(t) {
                 return t.popup({
                     title: "Tweet",
                     url: 'tweet.html',
                 });
             }
         }];
    },
});
