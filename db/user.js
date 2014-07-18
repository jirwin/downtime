var mongoose = require('mongoose');

var checkSchema = require('./check').checkSchema;

var userSchema = new mongoose.Schema({
  name:  String,
  email: String,
  gravatar:   String,
  entityId: String,
  checks: [checkSchema],
  alarms: Boolean,
  notificationId: String
});

var User = new mongoose.model('User', userSchema);

exports.userSchema = userSchema;
exports.User = User;
