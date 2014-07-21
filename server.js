var http = require('http');

var async = require('async');
var express = require('express');
var passport = require('passport');
var flash = require('connect-flash');
var GitHubStrategy = require('passport-github').Strategy
var MongoStore = require('connect-mongo')(express);

var config = require('./config');
var db = require('./lib/db');
var mc = require('./lib/monitoring').getMonitoringClient();
var WebhookServer = require('./lib/webhookServer');
var handlers = require('./lib/handlers');

var app = express();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({
      secret: config.sessionSecret,
      store: new MongoStore({
        db: config.mongo.db
      })
    }));
  app.use(express.csrf());
  app.use('/static', express.static(__dirname + '/public'));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());
  app.use(app.router);
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

app.get('/', handlers.index);

app.get('/login', handlers.login);

app.get('/create', handlers.create);

app.post('/createCheck', handlers.createCheck);

app.get('/auth/github', passport.authenticate('github'), function(req, res){
});

app.get('/auth/github/callback',
        passport.authenticate('github', { failureRedirect: '/login' }),
        function(req, res) {
          req.flash('success', 'Successfully logged in with Github!');
          res.redirect('/');
        });

app.get('/logout', handlers.logout);


var server, webhookServer;

function main() {
  async.series([
    db.initialize.bind(null),

    function startExpress(callback) {
      server = app.listen(config.webserver.port, function() {
        console.log('listening on port ' + config.webserver.port);
        callback();
      });
    },

    function createWebhookServer(callback) {
      webhookServer = new WebhookServer(config.webhook.port, config.webhook.host);
      webhookServer.listen(callback);
    },
  ], function(err) {
    if (err) {
      console.error('Some error starting up.');
    }

    console.log('Successfully started.');
  });
}

main();
