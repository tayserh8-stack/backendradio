/**
 * Bonus Controller
 * Handles bonus management operations
 */
const Bonus = require('../models/Bonus');
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
 * Delete bonus
 * DELETE /api/bonuses/:id
 * - Admin can delete any bonus anytime
 * - Manager can delete their own bonus within 1 day (24 hours)
 */
const deleteBonus = async (req, res) => {
  try {
    const bonus = await Bonus.findById(req.params.id);
    
    if (!bonus) {
      return res.status(404).json({ success: false, message: 'Bonus not found' });
    }
    
    const userRole = req.user.role;
    const userId = req.user._id.toString();
    const givenById = bonus.givenBy?.toString();
    const bonusCreatedAt = new Date(bonus.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now - bonusCreatedAt) / (1000 * 60 * 60);
    
    // Admin can delete any bonus
    if (userRole === 'admin') {
      await bonus.deleteOne();
      return res.json({ success: true, message: 'Bonus deleted successfully' });
    }
    
    // Manager can delete their own bonus within 24 hours
    if (userRole === 'manager' && givenById === userId) {
      if (hoursSinceCreation > 24) {
        return res.status(403).json({ 
          success: false, 
          message: 'Cannot delete after 24 hours. Contact admin to delete.' 
        });
      }
      await bonus.deleteOne();
      return res.json({ success: true, message: 'Bonus deleted successfully' });
    }
    
    return res.status(403).json({ success: false, message: 'Not authorized' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting bonus' });
  }
};

/**
 * Approve bonus (admin only)
 * PUT /api/bonuses/:id/approve
 */
const approveBonus = async (req, res) => {
  try {
    const bonus = await Bonus.findById(req.params.id);
    
    if (!bonus) {
      return res.status(404).json({ success: false, message: 'Bonus not found' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    bonus.isApproved = true;
    await bonus.save();
    
    res.json({ success: true, message: 'Bonus approved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error approving bonus' });
  }
};

module.exports = {
  getBonusesByEmployee,
  getAllBonuses,
  createBonus,
  deleteBonus,
  approveBonus
};