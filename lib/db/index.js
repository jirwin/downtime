var async = require('async');
var mongoose = require('mongoose');

var User = require('./user').User;

var db;

exports.getUser = function getUser(email, callback) {
  User.findOne({email: email}, callback);
};

exports.findAndUpdateUser = function updateUser(email, params, callback) {
  User.findOneAndUpdate({email: email}, params, {upsert: true}, callback);
};

exports.initialize = function initMongo(callback) {
  mongoose.connect('mongodb://localhost/downtime');

  db = mongoose.connection;

  db.on('error', function(err) {
    console.error('connection error:', err);
    callback(err);
  });
  db.once('open', callback);
};
