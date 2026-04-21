/**
 * Message Routes
 * Internal messaging system endpoints
 */

const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { protect } = require('../middleware/authMiddleware');

// GET /api/messages/inbox - Get received messages
router.get('/inbox', protect, async (req, res) => {
  try {
    const messages = await Message.find({ receiver: req.user._id })
      .populate('sender', 'name email role department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { messages } });
  } catch (error) {
    console.error('Error fetching inbox:', error);
    res.status(500).json({ success: false, message: 'Error fetching messages' });
  }
});

// GET /api/messages/sent - Get sent messages
router.get('/sent', protect, async (req, res) => {
  try {
    const messages = await Message.find({ sender: req.user._id })
      .populate('receiver', 'name email role department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { messages } });
  } catch (error) {
    console.error('Error fetching sent messages:', error);
    res.status(500).json({ success: false, message: 'Error fetching messages' });
  }
});

// GET /api/messages/unread - Get unread messages count
router.get('/unread', protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({ 
      receiver: req.user._id, 
      isRead: false 
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, message: 'Error fetching count' });
  }
});

// POST /api/messages - Send a message
router.post('/', protect, async (req, res) => {
  try {
    const { receiverId, subject, content } = req.body;
    
    if (!receiverId || !subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'يرجى填写 جميع الحقول المطلوبة'
      });
    }
    
    // Cannot send message to yourself
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكنك إرسال رسالة لنفسك'
      });
    }
    
    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      subject,
      content
    });
    
    await message.populate('sender', 'name email');
    await message.populate('receiver', 'name email role department');
    
    res.status(201).json({
      success: true,
      message: 'تم إرسال الرسالة بنجاح',
      data: { message }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Error sending message' });
  }
});

// PUT /api/messages/:id/read - Mark message as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const message = await Message.findOne({ 
      _id: req.params.id, 
      receiver: req.user._id 
    });
    
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'الرسالة غير موجودة' 
      });
    }
    
    message.isRead = true;
    message.readAt = new Date();
    await message.save();
    
    res.json({ success: true, message: 'تم قراءة الرسالة' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ success: false, message: 'Error updating message' });
  }
});

// PUT /api/messages/:id/archive - Archive message
router.put('/:id/archive', protect, async (req, res) => {
  try {
    const message = await Message.findOne({ 
      _id: req.params.id,
      $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    });
    
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'الرسالة غير موجودة' 
      });
    }
    
    message.isArchived = true;
    await message.save();
    
    res.json({ success: true, message: 'تم أرشفة الرسالة' });
  } catch (error) {
    console.error('Error archiving message:', error);
    res.status(500).json({ success: false, message: 'Error archiving message' });
  }
});

// DELETE /api/messages/:id - Delete message
router.delete('/:id', protect, async (req, res) => {
  try {
    const message = await Message.findOne({ 
      _id: req.params.id,
      $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    });
    
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'الرسالة غير موجودة' 
      });
    }
    
    await message.deleteOne();
    
    res.json({ success: true, message: 'تم حذف الرسالة بنجاح' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, message: 'Error deleting message' });
  }
});

module.exports = router;