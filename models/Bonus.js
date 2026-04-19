const mongoose = require('mongoose');

const bonusSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  givenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  reason: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['reward', 'prize', 'bonus'],
    default: 'reward'
  }
}, { timestamps: true });

module.exports = mongoose.model('Bonus', bonusSchema);