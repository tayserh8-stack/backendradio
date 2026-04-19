const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم القسم مطلوب'],
    unique: true,
    trim: true,
    minlength: 2
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Department', departmentSchema);