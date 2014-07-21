var async = require('async');
var _ = require('underscore');

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
    },
    _csrf: req.csrfToken()
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


exports.dashboard = function(req, res) {
  var params = getDefaultParams(req, res);

  if (!req.user) {
    req.flash('error', 'Please sign in to view your dashboard.');
    res.redirect('/login');
    return;
  };

  if (req.user.checks.length === 0) {
    res.redirect('/create');
    return;
  }

  async.auto({
    overview: function(callback) {
      mc.entityOverview(req.user.entityId, function(err, info) {
        var infoObj = {};

        if (err) {
          callback(err);
          return;
        }

        info.latest_alarm_states = _.sortBy(info.latest_alarm_states, function(las) {
          if (las.state === 'OK') {
            return 3;
          } else if (las.state === 'WARNING') {
            return 2;
          } else if (las.state === 'CRITICAL') {
            return 1;
          } else {
            return 0;
          }
        });

        info.latest_alarm_states.forEach(function(las) {
          if (!infoObj.hasOwnProperty(las.check_id)) {
            infoObj[las.check_id] = las;
          }
        });

        info.checks.forEach(function(check) {
          if (infoObj[check.id]) {
            infoObj[check.id].url = check.label;
          } else {
            infoObj[check.id] = {
              url: check.label
            }
          }
        });
        callback(null, infoObj);
      });
    },

    metrics: function(callback) {
      var checks = [];

      mc.getMetrics(req.user.entityId, _.pluck(req.user.checks, 'id').filter(function(item) { return item; }), callback);
    }
  }, function(err, results) {
    if (err) {
      req.flash('error', 'We could not load your dashboard. Sorry!');
      res.render('dashboard', params);
      return;
    }

    if (Object.keys(results.overview).length === 0) {
      res.redirect('/create');
      return;
    }

    params.checks = results.overview;
    params.metrics = _.indexBy(results.metrics, 'check_id');

    res.render('dashboard', params);
  });
};


exports.removeCheck = function(req, res) {
  var body = req.body;

  if (!req.user) {
    req.flash('error', 'You must be logged in!');
    res.redirect('/login');
    return;
  };

  async.auto({
    user: function getUser(callback) {
      db.getUser(req.user.email, callback);
    },

    check: function createCheck(callback) {
      mc.removeCheck(req.user.entityId, body.check, callback);
    }
  }, function(err, results) {
    if (err) {
      req.flash('error', 'There was an error removing your monitor. Please try again later.');
      res.redirect('/dashboard');
      return;
    }

    var user = results.user;

    user.checks = _.without(user.checks, _.findWhere(user.checks, {id: body.check}));

    user.save(function(err, newUser, num) {
      if (err) {
        req.flash('error', 'An error occurred.');
        redirect('/dashboard');
        return;
      }

      req.flash('success', 'Successfully removed your monitor');
      res.redirect('/dashboard');
    });
  });
};


exports.createCheck = function(req, res) {
  var body = req.body,
      target;

  if (!req.user) {
    req.flash('error', 'You must be logged in to monitor a website!');
    res.redirect('/login');
    return;
  }

  if (!req.form.isValid) {
    res.render('createCheck', getDefaultParams(req, res));
    return;
  }

  target = body['target'];

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
      res.redirect('/dashboard');
    });
  });
};


exports.logout = function(req, res) {
  req.logout();
  req.flash('success', 'Successfully logged out!');
  res.redirect('/');
};
