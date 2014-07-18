var express = require('express');
var passport = require('passport');
var flash = require('connect-flash');
var GitHubStrategy = require('passport-github').Strategy

var app = express();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static('public'));
  app.use(flash());
});

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: '06a51ae9579066cf2e49',
    clientSecret: '6d37ea6a4855611af2ba228f4f6cf7b871393a62',
    callbackURL: "http://peenbin.mirwin.net:3000/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
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


var server = app.listen(3000, function() {
  console.log('listening');
});
