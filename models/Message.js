/**
 * Message Model
 * Internal messaging system
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Index for faster queries
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });

// Mark message as read
messageSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  await this.save();
};

// Static method to get unread count for user
messageSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ receiver: userId, isRead: false });
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;