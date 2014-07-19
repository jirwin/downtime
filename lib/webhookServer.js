var http = require('http');

var JSONStream = require('JSONStream');

var config = require('../config');


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


WebhookServer.prototype.handleWebhook = function(obj) {
  console.log(JSON.stringify(obj, null, 4));
};


WebhookServer.prototype.listen = function(callback) {
  this.server.listen(this.port, this.host, callback);
};


module.exports = WebhookServer;
