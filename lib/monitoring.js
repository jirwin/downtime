var url = require('url');

var async = require('async');
var request = require('request');
var Identity = require('pkgcloud/lib/pkgcloud/rackspace/identity').Identity;

var config = require('../config');

var mc;

var HTTP_ALARM_CRITERIA = [
  "if (metric['code'] regex '4[0-9][0-9]') {",
  "  return new AlarmStatus(CRITICAL, 'HTTP server responding with 4xx status');",
  "}",
  "",
  "if (metric['code'] regex '5[0-9][0-9]') {",
  "  return new AlarmStatus(CRITICAL, 'HTTP server responding with 5xx status');",
  "}",
  "",
  "return new AlarmStatus(OK, 'HTTP server is functioning normally');"
].join('\n');


var MonitoringAuthClient = function(user, apiKey) {
  this._user = user;
  this._apiKey = apiKey;
  this.options = {
    username: user,
    apiKey: apiKey,
    url: 'https://identity.api.rackspacecloud.com',
    region: 'DFW'
  }
  this.identity = new Identity(this.options);
  this.expiration = Date.now();
};

MonitoringAuthClient.prototype.getToken = function(callback) {
  var now = Date.now();

  if (now < this.expiration && this.identity.token) {
    process.nextTick(callback.bind(null, null, this.identity.token.id));
  } else {
    this.updateToken(callback);
  }
};


MonitoringAuthClient.prototype.updateToken = function(callback) {
  var self = this;

  this.identity.authorize(self.options, function(err) {
    if (err) {
      console.error('Error updating token.', err);
      callback(err);
      return;
    }

    self.expiration = self.identity.token.expires - (30 * 1000); // Give token expiration a 30 second buffer
    callback(null, self.identity.token.id);
  });
};


var MonitoringClient = function() {
  this.identity = new MonitoringAuthClient(config.rax.user, config.rax.apiKey);
};


MonitoringClient.prototype.defaultHeaders = function(token) {
  return {
    'X-Auth-Token': token
  };
};


MonitoringClient.prototype.getApiUrl = function(endpoint) {
  return 'https://monitoring.api.rackspacecloud.com/v1.0/' + config.rax.tenant + '/' + endpoint;
};


MonitoringClient.prototype.entityOverview = function(entity, callback) {
  var self = this;

  async.auto({
    token: this.identity.getToken.bind(this.identity),

    overview: ['token', function entityOverview(callback, results) {
      var headers = self.defaultHeaders(results.token),
          url = self.getApiUrl('views/overview');

      request.get({
        uri: url,
        qs: {entityId: entity},
        headers: headers
      }, function(err, res, body) {
        if (err || res.statusCode != 200) {
          console.error('Error getting overview for entity', err, res.body);
          callback(err);
          return;
        }

        callback(null, JSON.parse(body).values[0]);
      });
    }]
  }, function(err, results) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, results.overview);
  });
};

MonitoringClient.prototype.createEntity = function(id, email, callback) {
  var self = this,
      enParams;

  enParams = {
    label: email,
    metadata: {
      userId: id,
      email: email
    }
  };

  async.auto({
    token: this.identity.getToken.bind(this.identity),

    create: ['token', function createEntity(callback, results) {
      var headers = self.defaultHeaders(results.token),
          url = self.getApiUrl('entities');

      request.post({
        uri: url,
        headers: headers,
        body: JSON.stringify(enParams)
      }, function(err, res, body) {
        if (err || res.statusCode != 201) {
          console.error('Error creating entity', err, res.body);
          callback(err);
          return;
        }

        callback(null, res.headers['x-object-id']);
      });
    }]
  }, function(err, results) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, results.create);
  });
};


MonitoringClient.prototype.createHttpCheck = function(entity, label, target, callback) {
  var self = this,
      chParams,
      parsedUrl = url.parse(target);

  chParams = {
    label: label,
    type: 'remote.http',
    details: {
      url: target,
      method: 'GET'
    },
    monitoring_zones_poll: ['mzord', 'mzdfw', 'mziad'],
    target_hostname: parsedUrl.host
  };

  async.auto({
    token: this.identity.getToken.bind(this.identity),

    create: ['token', function createCheck(callback, results) {
      var headers = self.defaultHeaders(results.token),
          url = self.getApiUrl('entities/' + entity + '/checks');

      request.post({
        uri: url,
        headers: headers,
        body: JSON.stringify(chParams)
      }, function(err, res, body) {
        if (err || res.statusCode != 201) {
          console.error('Error creating check', err, res.body);
          callback(err);
          return;
        }

        callback(null, res.headers['x-object-id']);
      });
    }]
  }, function(err, results) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, results.create);
  });
};


MonitoringClient.prototype.createHttpAlarm = function(entity, check, callback) {
  var self = this,
      alParams;

  alParams = {
    check_id: check,
    criteria: HTTP_ALARM_CRITERIA,
    notification_plan_id: config.rax.notificationPlan
  };

  async.auto({
    token: this.identity.getToken.bind(this.identity),

    create: ['token', function createCheck(callback, results) {
      var headers = self.defaultHeaders(results.token),
          url = self.getApiUrl('entities/' + entity + '/alarms');

      request.post({
        uri: url,
        headers: headers,
        body: JSON.stringify(alParams)
      }, function(err, res, body) {
        if (err || res.statusCode != 201) {
          console.error('Error creating alarm', err, res.body);
          callback(err);
          return;
        }

        callback(null, res.headers['x-object-id']);
      });
    }]
  }, function(err, results) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, results.create);
  });
};


MonitoringClient.prototype.removeCheck = function(entity, check, callback) {
  var self = this;

  async.auto({
    token: this.identity.getToken.bind(this.identity),

    create: ['token', function createCheck(callback, results) {
      var headers = self.defaultHeaders(results.token),
          url = self.getApiUrl('entities/' + entity + '/checks/' + check);

      request.del({
        uri: url,
        headers: headers
      }, function(err, res, body) {
        if (err || res.statusCode != 204) {
          console.error('Error removing check', err, res.body);
          callback(err);
          return;
        }

        callback();
      });
    }]
  }, function(err, results) {
    if (err) {
      callback(err);
      return;
    }

    callback();
  });
};


exports.MonitoringClient = MonitoringClient;

exports.getMonitoringClient = function() {
  if (!mc) {
    mc = new MonitoringClient();
  }
  return mc;
};
