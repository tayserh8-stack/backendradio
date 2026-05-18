/**
 * Attendance Routes
 * Employee attendance tracking endpoints
 */

const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceHistory,
  getAttendanceStats,
  getDepartmentAttendance,
  updateAttendance
} = require('../controllers/attendanceController');
const { protect, managerOrAdmin, adminOnly } = require('../middleware/authMiddleware');

// POST /api/attendance/check-in - Check in
router.post('/check-in', protect, checkIn);

// POST /api/attendance/check-out - Check out
router.post('/check-out', protect, checkOut);

// GET /api/attendance/today - Get today's attendance
router.get('/today', protect, getTodayAttendance);

// GET /api/attendance/history - Get attendance history
router.get('/history', protect, getAttendanceHistory);

// GET /api/attendance/stats - Get attendance statistics
router.get('/stats', protect, getAttendanceStats);

// GET /api/attendance/department/:department - Get department attendance (manager/admin)
router.get('/department/:department', protect, managerOrAdmin, getDepartmentAttendance);

// PUT /api/attendance/:id - Update attendance record (admin/hr only)
const hrAndAdmin = (req, res, next) => {
  const role = req.user?.role?.toLowerCase() || '';
  const dept = req.user?.department?.toLowerCase() || '';
  const isHrDept = dept === 'hr' || dept === 'human resources' || dept === 'الموارد البشرية';
  if (role === 'admin' || role === 'hr' || (role === 'manager' && isHrDept)) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'غير مصرح لك بالوصول لهذه الصفحة'
    });
  }
};
router.put('/:id', protect, hrAndAdmin, updateAttendance);

module.exports = router;
