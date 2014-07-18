var async = require('async');
var express = require('express');
var passport = require('passport');
var flash = require('connect-flash');
var GitHubStrategy = require('passport-github').Strategy

var config = require('./config');
var db = require('./lib/db');

var app = express();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ secret: config.sessionSecret }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static('public'));
  app.use(flash());
});

passport.serializeUser(function(user, done) {
  done(null, user.email);
});

passport.deserializeUser(function(email, done) {
  db.getUser(email, function(err, user) {
    if (err) {
      console.log('no user found for', email);
      done();
      return;
    }
    done(null, user);
  });
});

passport.use(new GitHubStrategy({
    clientID: config.github.clientId,
    clientSecret: config.github.clientSecret,
    callbackURL: config.github.authCallbackUri
  },
  function(accessToken, refreshToken, profile, done) {
    var params = {
      name: profile._json.name,
      email: profile._json.email,
      githubId: profile.id,
      gravatar: profile._json.gravatar_id
    }
    db.findAndUpdateUser(profile._json.email, params, function(err, user) {
      return done(err, user);
    });
  }
));

app.get('/', function(req, res) {
  console.dir(req.user);
  res.render('index', {user: req.user});
});

app.get('/login', function(req, res) {
  res.render('login', {user: req.user});
});

app.get('/auth/github', passport.authenticate('github'), function(req, res){
});

app.get('/auth/github/callback',
        passport.authenticate('github', { failureRedirect: '/login' }),
        function(req, res) {
          res.redirect('/');
        });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});


var server;

function main() {
  async.series([
    db.initialize.bind(null),

    function startExpress(callback) {
      server = app.listen(80, function() {
        console.log('listening on port 80');
        callback();
      });
    }
  ], function(err) {
    if (err) {
      console.error('Some error starting up.');
    }

    console.log('Successfully started.');
  });
}

main();
