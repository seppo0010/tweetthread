/* global TrelloPowerUp */

var t = TrelloPowerUp.iframe();

var tweetHasError = function(tweet) {
  tweet = tweet.replace(/!\[.*?\]\(.*?\)/g, '').trim()
  const len = window.twttr.txt.parseTweet(tweet).weightedLength
  if (len > 280) {
    return 'too long (' + len + ')'
  }
  return null;
}

var createTweet = function(card) {
  const tweets = card.desc.split(/\n\s*\*{3,}\s*\n/g);
  for (var i = 0; i < tweets.length; i++) {
    const t = tweets[i];
    const err = tweetHasError(t)
    if (err) {
      alert('"' + t + '" is ' + err)
      return
    }
  }
  return fetch('/tweet', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: JSON.parse(window.fromAccount.value),
      tweets: tweets,
    }),
  })
}

window.tweet.addEventListener('submit', function(event){
  event.preventDefault();
  return t.card('all').then(function(card) {
    return createTweet(card);
  })
  .then(function(){
    t.closePopup();
  });
});


var populateDropdown = function(dd, list) {
    while (dd.firstChild) dd.removeChild(dd.firstChild)
    list.forEach(function(a) {
      var el = document.createElement('option');
      el.value = JSON.stringify(a)
      el.innerText = a.userName
      dd.appendChild(el);
    });
};

var r = function(){
  return t.get('card', 'shared', 'accounts')
  .then(function(accounts){
    populateDropdown(window.fromAccount, accounts);
    populateDropdown(window.removeAccount, accounts);
  });
};

window.addAccount.addEventListener('submit', function(event){
  event.preventDefault();
  return fetch('/add-twitter-account')
    .then(response => response.json())
    .then(function(res) {
      const w = 600;
      const h = 600;
      const y = window.outerHeight / 2 + window.screenY - ( h / 2);
      const x = window.outerWidth / 2 + window.screenX - ( w / 2);
      const myWindow = window.open(res.url, `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=yes, copyhistory=no, width=${w}, height=${h}, top=${y}, left=${x}`);
      window.callback = function(oauthToken, oauthVerifier) {
        return fetch('/add-twitter-account-ready', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            oauthToken,
            oauthVerifier,
            tokenSecret: res.tokenSecret,
          }),
        }).then(response => response.json()).then((user) => {
          myWindow.close()
          return t.get('card', 'shared', 'accounts')
          .then(function(accounts){
            if (!accounts) accounts = []
            accounts.push(user);
            return t.set('card', 'shared', 'accounts', accounts);
          })
          .then(function(){
            r()
          });
	})
      }
  });
});

window.removeAccountForm.addEventListener('submit', function(event){
  event.preventDefault();
  return t.get('card', 'shared', 'accounts')
  .then(function(accounts){
    if (!accounts) accounts = []
    accounts = accounts.filter((a) => a.userName !== JSON.parse(window.removeAccount.value).userName)
    return t.set('card', 'shared', 'accounts', accounts);
  })
  .then(function(){
    r()
  });
});

t.render(r);
