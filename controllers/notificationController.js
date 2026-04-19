/**
 * Notification Controller
 * Handles notification operations
 */

const { Notification, NotificationType } = require('../models/Notification');

/**
 * Get notifications for current user
 * GET /api/notifications
 */
const getMyNotifications = async (req, res) => {
  try {
    const { unreadOnly } = req.query;
    
    const query = {
      user: req.user._id
    };

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .populate('relatedTask', 'title')
      .sort({ createdAt: -1 })
      .limit(50);

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الإشعارات:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: 'تم تحديد الإشعار كمقروء',
      data: {
        notification
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث الإشعار:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({
      success: true,
      message: 'تم تحديد جميع الإشعارات كمقروءة'
    });
  } catch (error) {
    console.error('خطأ في تحديث الإشعارات:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }

    res.json({
      success: true,
      message: 'تم حذف الإشعار'
    });
  } catch (error) {
    console.error('خطأ في حذف الإشعار:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Delete all read notifications
 * DELETE /api/notifications/clear-read
 */
const clearReadNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({
      user: req.user._id,
      isRead: true
    });

    res.json({
      success: true,
      message: 'تم حذف الإشعارات المقروءة'
    });
  } catch (error) {
    console.error('خطأ في حذف الإشعارات:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications
};