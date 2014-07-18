var async = require('async');
var mongoose = require('mongoose');

var User = require('./user').User;



exports.getUser = function getUser(email, callback) {

mongoose.connect('mongodb://localhost/downtime');
};
