var async = require('async');

var db = require('./db');
var mc = require('./monitoring').getMonitoringClient();


function getDefaultParams(req, res) {
  return {
    user: req.user,
    flash: {
      info: req.flash('info'),
      success: req.flash('success'),
      warning: req.flash('warning'),
      error: req.flash('error')
    }
  };
}


exports.index = function(req, res) {
  var params = getDefaultParams(req, res);
  res.render('index', params);
};


exports.login = function(req, res) {
  var params = getDefaultParams(req, res);
  res.render('login', params);
};


exports.create = function(req, res) {
  var params = getDefaultParams(req, res);

  if (!req.user) {
    req.flash('error', 'You must be logged in to monitor a website!');
    res.redirect('/login');
    return;
  }

  res.render('createCheck', params);
};


exports.createCheck = function(req, res) {
  var body = req.body,
      target;

  if (!req.user) {
    req.flash('error', 'You must be logged in to monitor a website!');
    res.redirect('/login');
    return;
  }

  if (!body['check-target']) {
    req.flash('error', 'You must enter a URL to monitor!');
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
    if (err) {
      req.flash('error', 'There was an error creating your monitor. Please double check the URL and try again!');
      res.redirect('/create');
      return;
    }

    var user = results.user,
        check = {
          id: results.check,
          label: target,
          url: target,
          alarmId: results.alarm
        };

    user.checks.push(check);
    user.save(function(err, newUser, num) {
      if (err) {
        req.flash('error', 'An error occurred.');
        redirect('/create');
        return;
      }

      req.flash('success', 'Successfully started monitoring your website!');
      res.redirect('/create');
    });
  });
};


exports.logout = function(req, res) {
  req.logout();
  req.flash('success', 'Successfully logged out!');
  res.redirect('/');
};