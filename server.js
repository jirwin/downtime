var http = require('http');

var async = require('async');
var express = require('express');
var passport = require('passport');
var flash = require('connect-flash');
var GitHubStrategy = require('passport-github').Strategy
var JSONStream = require('JSONStream');

var config = require('./config');
var db = require('./lib/db');
var mc = require('./lib/monitoring').getMonitoringClient();

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
      if (!user.entityId) {
        mc.createEntity(user.githubId, user.email, function(err, enId) {
          if (err) {
            done(null, user);
            return;
          }

          user.entityId = enId;
          user.save(function(err, newUser, num) {
            if (err) {
              done(err);
              return;
            }

            done(err, newUser);
          });
        });
        return;
      }

      return done(err, user);
    });
  }
));

app.get('/', function(req, res) {
  res.render('index', {user: req.user});
});

app.get('/login', function(req, res) {
  res.render('login', {user: req.user});
});

app.get('/create', function(req, res) {
  if (!req.user) {
    res.redirect('/login');
    return;
  }

  res.render('createCheck', {user: req.user});
});

app.post('/createCheck', function(req, res) {
  var body = req.body,
      target;

  if (!req.user) {
    res.redirect('/login');
    return;
  }

  if (!body['check-target']) {
    res.redirect('/create');
    return;
  }

  target = body['check-target'];

  async.auto({
    user: function getUser(callback) {
      db.getUser(req.user.email, callback);
    },

    check: function createCheck(callback) {
      mc.createHttpCheck(req.user.entityId, target, target, callback);
    },

    alarm: ['check', function createAlarm(callback, results) {
      var chId = results.check;
      mc.createHttpAlarm(req.user.entityId, chId, callback);
    }]
  }, function(err, results) {
    var user = results.user,
        check = {
          id: results.check,
          label: target,
          url: target,
          alarmId: results.alarm
        };

    user.checks.push(check);
    user.save(function(err, newUser, num) {
      res.redirect('/create');
    });
  });
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


var server, webhookServer;

function main() {
  async.series([
    db.initialize.bind(null),

    function startExpress(callback) {
      server = app.listen(80, function() {
        console.log('listening on port 80');
        callback();
      });
    },

    function createWebhookServer(callback) {
      webhookServer = http.createServer(function(req, res) {
        var jsonStream = JSONStream.parse(true);

        req.pipe(jsonStream);

        jsonStream.on('data', function(obj) {
          console.log(JSON.stringify(obj, null, 4));
        });

        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('okay');
      });
      webhookServer.listen(8484, '162.242.217.236', callback);
    },
  ], function(err) {
    if (err) {
      console.error('Some error starting up.');
    }

    console.log('Successfully started.');
  });
}

main();
