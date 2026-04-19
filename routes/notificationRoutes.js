/**
 * Notification Routes
 * Notification endpoints
 */

const express = require('express');
const router = express.Router();
const { 
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/notifications - Get my notifications
router.get('/', protect, getMyNotifications);

// PUT /api/notifications/:id/read - Mark as read
router.put('/:id/read', protect, markAsRead);

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', protect, markAllAsRead);

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', protect, deleteNotification);

// DELETE /api/notifications/clear-read - Clear read notifications
router.delete('/clear-read', protect, clearReadNotifications);

module.exports = router;