/**
 * Leave Routes
 */
const express = require('express');
const router = express.Router();
const {
  createLeaveRequest, validateLeaveRequest, getLeaveRequests, getLeaveRequestById,
  updateLeaveStatus, cancelLeaveRequest, getLeaveBalance, getPendingLeaveRequests, getDepartmentLeaveCalendar,
} = require('../controllers/leaveController');
const { protect, managerOrAdmin, adminOnly } = require('../middleware/authMiddleware');

router.post('/', protect, createLeaveRequest);
router.post('/validate', protect, validateLeaveRequest);
router.get('/', protect, getLeaveRequests);
router.get('/balance', protect, getLeaveBalance);
router.get('/pending', protect, managerOrAdmin, getPendingLeaveRequests);
router.get('/:id', protect, getLeaveRequestById);
router.put('/:id/status', protect, managerOrAdmin, updateLeaveStatus);
router.delete('/:id', protect, cancelLeaveRequest);
router.get('/calendar/:department', protect, managerOrAdmin, getDepartmentLeaveCalendar);

module.exports = router;