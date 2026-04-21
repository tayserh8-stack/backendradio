const express = require('express');
const router = express.Router();
const Bonus = require('../models/Bonus');
const { User } = require('../models/User');
const { Notification, NotificationType } = require('../models/Notification');
const { protect, managerOrAdmin } = require('../middleware/authMiddleware');

// Get all bonuses for employee
router.get('/employee/:employeeId', protect, async (req, res) => {
  try {
    const bonuses = await Bonus.find({ employee: req.params.employeeId })
      .populate('givenBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { bonuses } });
  } catch (error) {
    console.error('Error in /employee/:id:', error);
    res.status(500).json({ success: false, message: 'Error fetching bonuses' });
  }
});

// Give bonus to employee (manager/admin only)
router.post('/', protect, managerOrAdmin, async (req, res) => {
  try {
    const { employeeId, points, reason, type } = req.body;
    
    if (!employeeId || !points || !reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'يرجى ملء جميع الحقول المطلوبة' 
      });
    }
    
    const bonus = await Bonus.create({
      employee: employeeId,
      givenBy: req.user._id,
      points,
      reason,
      type: type || 'reward'
    });
    
    // Update employee performance score
    const employee = await User.findById(employeeId);
    if (employee) {
      const currentBonus = await Bonus.aggregate([
        { $match: { employee: employee._id } },
        { $group: { _id: null, total: { $sum: '$points' } } }
      ]);
      const bonusPoints = currentBonus[0]?.total || 0;
      
      // Add bonus points to performance (max 10% of total score)
      employee.performanceScore = Math.min(employee.performanceScore + (bonusPoints * 0.1), 100);
      await employee.save();
    }

    // Create notification for employee
    await Notification.createNotification(
      employeeId,
      NotificationType.REWARD,
      '🎁 مكافأة جديدة',
      `لقد حصلت على ${points} نقاط - ${reason}`,
      null
    );
    
    res.json({ success: true, data: { bonus } });
  } catch (error) {
    console.error('Error in POST /bonuses:', error);
    res.status(500).json({ success: false, message: 'Error creating bonus: ' + error.message });
  }
});

// Get all bonuses (admin/manager)
router.get('/all', protect, managerOrAdmin, async (req, res) => {
  try {
    console.log('=== Fetching all bonuses ===');
    console.log('Bonus model:', Bonus);
    console.log('Bonus.find:', typeof Bonus.find);
    
    const bonuses = await Bonus.find()
      .populate('employee', 'name department')
      .populate('givenBy', 'name')
      .sort({ createdAt: -1 });
    console.log('Found bonuses:', bonuses.length);
    res.json({ success: true, data: bonuses });
  } catch (error) {
    console.error('Error fetching bonuses:', error);
    res.status(500).json({ success: false, message: 'Error fetching bonuses: ' + error.message });
  }
});

// Delete bonus (admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const bonus = await Bonus.findById(req.params.id);
    if (!bonus) {
      return res.status(404).json({ success: false, message: 'Bonus not found' });
    }

    // Only admin can delete bonuses
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await bonus.deleteOne();
    res.json({ success: true, message: 'Bonus deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting bonus' });
  }
});

module.exports = router;