var mongoose = require('mongoose');

var checkSchema = new mongoose.Schema({
  id: String,
  label: String,
  url: String,
  alarmId: String,
  alarmType: String
});

exports.checkSchema = checkSchema;
