var mongoose = require('mongoose');

var checkSchema = require('./check').checkSchema;

var userSchema = new mongoose.Schema({
  name:  String,
  email: String,
  githubId: String,
  gravatar: String,
  entityId: String,
  checks: [checkSchema],
  notificationId: String
});

var User = mongoose.model('User', userSchema);

exports.userSchema = userSchema;
exports.User = User;
