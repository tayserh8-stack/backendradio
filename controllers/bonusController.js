/**
 * Bonus Controller
 * Handles bonus management operations
 */
const { Bonus } = require('../models/Bonus');
const { User } = require('../models/User');
const { Notification, NotificationType } = require('../models/Notification');

/**
 * Get all bonuses for employee
 * GET /api/bonuses/employee/:employeeId
 */
const getBonusesByEmployee = async (req, res) => {
  try {
    const bonuses = await Bonus.find({ employee: req.params.employeeId })
      .populate('givenBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { bonuses } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bonuses' });
  }
};

/**
 * Get all bonuses (admin/manager)
 * GET /api/bonuses
 */
const getAllBonuses = async (req, res) => {
  try {
    const bonuses = await Bonus.find()
      .populate('employee', 'name department')
      .populate('givenBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { bonuses } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bonuses' });
  }
};

/**
 * Create bonus (admin/manager)
 * POST /api/bonuses
 */
const createBonus = async (req, res) => {
  try {
    const { employeeId, points, reason, type } = req.body;
    
    const bonus = await Bonus.create({
      employee: employeeId,
      givenBy: req.user._id,
      points,
      reason,
      type: type || 'reward'
    });
    
    // Update employee performance score
    const employee = await User.findById(employeeId);
    const currentBonus = await Bonus.aggregate([
      { $match: { employee: employee._id } },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);
    const bonusPoints = currentBonus[0]?.total || 0;
    
    // Add bonus points to performance (max 10% of total score)
    employee.performanceScore = Math.min(employee.performanceScore + (bonusPoints * 0.1), 100);
    await employee.save();
    
    // Create notification for employee
    await Notification.createNotification(
      employeeId,
      NotificationType.REWARD,
      '🎁 مكافأة جديدة',
      `لقد حصلت على ${points} نقاط - ${reason}`,
      null
    );
    
    // Find admin user and send notification
    const adminUser = await User.findOne({ role: 'admin' });
    if (adminUser && adminUser._id.toString() !== req.user._id.toString()) {
      await Notification.createNotification(
        adminUser._id,
        NotificationType.REWARD,
        '✅ تم منح مكافأة',
        `تم منح ${employee.name} مكافأة worth ${points} points - ${reason}`,
        null
      );
    }
    
    res.json({ success: true, message: 'تم إنشاء المكافأة بنجاح', data: { bonus } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating bonus' });
  }
};

/**
 * Delete bonus (admin only)
 * DELETE /api/bonuses/:id
 */
const deleteBonus = async (req, res) => {
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
};

module.exports = {
  getBonusesByEmployee,
  getAllBonuses,
  createBonus,
  deleteBonus
};