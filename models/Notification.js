/**
 * Notification Model
 * Stores user notifications
 */

const mongoose = require('mongoose');

// Notification type enum
const NotificationType = {
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_EVALUATED: 'task_evaluated',
  TASK_APPROVED: 'task_approved',
  TASK_REJECTED: 'task_rejected',
  NEW_USER_REGISTERED: 'new_user_registered',
  ROLE_CHANGE: 'role_change',
  REWARD: 'reward',
  NEW_MESSAGE: 'new_message'
};

// Notification Schema
const notificationSchema = new mongoose.Schema({
  // User who receives the notification
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Notification type
  type: {
    type: String,
    enum: Object.values(NotificationType),
    required: true
  },
  
  // Notification title
  title: {
    type: String,
    required: true
  },
  
  // Notification message
  message: {
    type: String,
    required: true
  },
  
  // Related task (optional)
  relatedTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  
  // Is notification read
  isRead: {
    type: Boolean,
    default: false
  },
  
  // Read timestamp
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for queries
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

// Static method to create notification
notificationSchema.statics.createNotification = async function(userId, type, title, message, taskId = null) {
  return this.create({
    user: userId,
    type,
    title,
    message,
    relatedTask: taskId
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification, NotificationType };