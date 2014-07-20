var http = require('http');

var JSONStream = require('JSONStream');
var Mailgun = require('mailgun-js');

var config = require('../config');

var mailgun = new Mailgun({apiKey: config.mailgun.apiKey, domain: config.mailgun.domain});


var mzMap = {
  mzord: 'Chicago',
  mzdfw: 'Dallas Fortworth',
  mziad: 'Dulles',
  mzlon: 'London',
  mzsyd: 'Sydney',
  mzhkg: 'Hong Kong'
};

var WebhookServer = function(port, host) {
  var self = this;

  this.port = port;
  this.host = host;
  this.server = http.createServer(function(req, res) {
    var jsonStream = JSONStream.parse(true);

    if (!req.headers['x-rackspace-webhook-token'] || req.headers['x-rackspace-webhook-token'] !== config.webhook.token) {
      res.writeHead(403, {'Content-Type': 'text/plain'});
      res.end('forbidden');
      return;
    }

    req.pipe(jsonStream);

    jsonStream.on('data', function(obj) {
      self.handleWebhook(obj);
    });

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('okay');
  });
};


WebhookServer.prototype.alertMessage = function(observations, url, status) {
  var body = [
        status + ' detected on ' + url,
        '',
        'Confirmed Observations:'
      ],
      mz;

  observations.forEach(function(observation) {
    if (observation.state === status) {
      mz = mzMap[observation.monitoring_zone_id] || observation.monitoring_zone_id;
      body.push('\t' + mz);
    }
  });

  return body.join('\n');
};


WebhookServer.prototype.handleWebhook = function(obj) {
  var observations = obj.details.observations,
      email = obj.entity.metadata.email,
      url = obj.check.details.url,
      status = obj.details.state,
      firstLine = '',
      mailgunData;

  console.log(JSON.stringify(obj, null, 4));

  mailgunData  = {
    from: 'Downtime Alert <downtime@mirwin.net>',
    to: email,
    subject: '*' + status + '* on ' + url,
    text: this.alertMessage(observations, url, status)
  };

  mailgun.messages().send(mailgunData, function (error, body) { });
};


WebhookServer.prototype.listen = function(callback) {
  this.server.listen(this.port, this.host, callback);
};


module.exports = WebhookServer;
