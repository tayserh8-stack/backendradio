/**
 * Attendance Controller
 * Handles employee attendance tracking
 */

const { Attendance, AttendanceStatus, CheckInStatus } = require('../models/Attendance');
const { User } = require('../models/User');
const { LeaveRequest, LeaveStatus } = require('../models/LeaveRequest');

/**
 * Check in employee
 * POST /api/attendance/check-in
 */
const checkIn = async (req, res) => {
  try {
    const { location, notes } = req.body;
    const employeeId = req.user._id;
    
    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    // Check if employee is active
    if (!employee.isActive) {
      return res.status(403).json({
        success: false,
        message: 'حسابك غير نشط'
      });
    }
    
    // Check if already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const existingAttendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: tomorrow }
    });
    
    if (existingAttendance && existingAttendance.checkIn && existingAttendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'لقد قمت بالفعل بعملية تسجيل الحضور اليوم'
      });
    }
    
    // Create or update attendance
    let attendance;
    if (existingAttendance) {
      attendance = existingAttendance;
    } else {
      attendance = new Attendance({
        employee: employeeId,
        date: new Date(),
        department: employee.department,
        expectedHours: 8,
        status: AttendanceStatus.PRESENT
      });
    }
    
    // Perform check-in
    attendance.checkInEmployee(new Date(), location, notes);
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'تم تسجيل الحضور بنجاح',
      data: {
        attendance: {
          checkIn: attendance.checkIn,
          status: attendance.status,
          isLate: attendance.isLate
        }
      }
    });
  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تسجيل الحضور',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Check out employee
 * POST /api/attendance/check-out
 */
const checkOut = async (req, res) => {
  try {
    const { location, notes } = req.body;
    const employeeId = req.user._id;
    
    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: tomorrow }
    });
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم تسجيل الحضور لهذا اليوم'
      });
    }
    
    if (!attendance.checkIn || !attendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'يجب تسجيل الحضور أولاً'
      });
    }
    
    if (attendance.checkOut && attendance.checkOut.time) {
      return res.status(400).json({
        success: false,
        message: 'لقد قمت بالفعل بعملية تسجيل المغادرة اليوم'
      });
    }
    
    // Perform check-out
    attendance.checkOutEmployee(new Date(), location, notes);
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'تم تسجيل المغادرة بنجاح',
      data: {
        attendance: {
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          duration: attendance.duration,
          overtime: attendance.overtime
        }
      }
    });
  } catch (error) {
    console.error('Error during check-out:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تسجيل المغادرة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get today's attendance
 * GET /api/attendance/today
 */
const getTodayAttendance = async (req, res) => {
  try {
    const employeeId = req.user._id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: today, $lt: tomorrow }
    });
    
    if (!attendance) {
      return res.json({
        success: true,
        data: {
          attendance: null,
          message: 'لم يتم تسجيل الحضور لهذا اليوم'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        attendance
      }
    });
  } catch (error) {
    console.error('Error getting today attendance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات الحضور',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get attendance history
 * GET /api/attendance/history
 */
const getAttendanceHistory = async (req, res) => {
  try {
    const { startDate, endDate, status, employeeId, page = 1, limit = 50 } = req.query;
    
    let query = {};
    
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      if (employeeId) query.employee = employeeId;
      if (req.user.role === 'manager' && !employeeId) {
        query.department = req.user.department;
      }
    } else {
      query.employee = req.user._id;
    }
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    if (status) query.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const attendances = await Attendance.find(query)
      .populate('employee', 'name email department')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Attendance.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        records: attendances,
        count: attendances.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting attendance history:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب سجل الحضور',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get attendance statistics
 * GET /api/attendance/stats
 */
const getAttendanceStats = async (req, res) => {
  try {
    const employeeId = req.user._id;
    const { startDate, endDate } = req.query;
    
    const query = { employee: employeeId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const attendances = await Attendance.find(query);
    
    const stats = {
      totalDays: attendances.length,
      present: attendances.filter(a => a.status === AttendanceStatus.PRESENT).length,
      absent: attendances.filter(a => a.status === AttendanceStatus.ABSENT).length,
      late: attendances.filter(a => a.status === AttendanceStatus.LATE).length,
      halfDay: attendances.filter(a => a.status === AttendanceStatus.HALF_DAY).length,
      onLeave: attendances.filter(a => a.status === AttendanceStatus.ON_LEAVE).length,
      workFromHome: attendances.filter(a => a.workFromHome).length,
      totalHours: attendances.reduce((sum, a) => sum + a.duration, 0),
      totalOvertime: attendances.reduce((sum, a) => sum + a.overtime, 0),
      averageHours: attendances.length > 0 
        ? attendances.reduce((sum, a) => sum + a.duration, 0) / attendances.length 
        : 0,
      lateRate: attendances.length > 0 
        ? (attendances.filter(a => a.status === AttendanceStatus.LATE).length / attendances.length * 100) 
        : 0
    };
    
    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Error getting attendance stats:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إحصائيات الحضور',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get department attendance (admin/manager only)
 * GET /api/attendance/department/:department
 */
const getDepartmentAttendance = async (req, res) => {
  try {
    const { department } = req.params;
    const { startDate, endDate } = req.query;
    
    // Check if user has access to this department
    if (req.user.role === 'manager' && req.user.department !== department) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول إلى أقسام أخرى'
      });
    }
    
    const query = { department };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const attendances = await Attendance.find(query)
      .populate('employee', 'name email')
      .sort({ date: -1 });
    
    const stats = await Attendance.getDepartmentStats(department, startDate, endDate);
    
    res.json({
      success: true,
      data: {
        attendances,
        stats
      }
    });
  } catch (error) {
    console.error('Error getting department attendance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات الحضور',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update attendance record (admin only)
 * PUT /api/attendance/:id
 */
const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isApproved, notes } = req.body;
    
    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الحضور غير موجود'
      });
    }
    
    if (status) attendance.status = status;
    if (isApproved !== undefined) attendance.isApproved = isApproved;
    if (notes) attendance.notes = notes;
    
    attendance.approvedBy = req.user._id;
    attendance.approvedAt = new Date();
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'تم تحديث سجل الحضور بنجاح',
      data: { attendance }
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث سجل الحضور',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceHistory,
  getAttendanceStats,
  getDepartmentAttendance,
  updateAttendance
};
