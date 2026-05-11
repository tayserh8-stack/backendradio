/**
 * Attendance Model
 * Employee attendance tracking with check-in/check-out
 */

const mongoose = require('mongoose');

// Attendance status enum
const AttendanceStatus = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  HALF_DAY: 'half_day',
  ON_LEAVE: 'on_leave',
  WORK_FROM_HOME: 'work_from_home'
};

// Check-in/out status
const CheckInStatus = {
  ON_TIME: 'on_time',
  LATE: 'late',
  VERY_LATE: 'very_late'
};

// Attendance Schema
const attendanceSchema = new mongoose.Schema({
  // Employee reference
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Date of attendance
  date: {
    type: Date,
    required: true
  },
  
  // Check-in time
  checkIn: {
    time: Date,
    status: {
      type: String,
      enum: Object.values(CheckInStatus),
      default: CheckInStatus.ON_TIME
    },
    location: String,
    notes: String
  },
  
  // Check-out time
  checkOut: {
    time: Date,
    location: String,
    notes: String
  },
  
  // Work duration in hours
  duration: {
    type: Number,
    default: 0
  },
  
  // Expected work hours for the day
  expectedHours: {
    type: Number,
    default: 8
  },
  
  // Overtime hours
  overtime: {
    type: Number,
    default: 0
  },
  
  // Attendance status
  status: {
    type: String,
    enum: Object.values(AttendanceStatus),
    default: AttendanceStatus.PRESENT
  },
  
  // Leave reference if on leave
  leave: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest',
    default: null
  },
  
  // Work from home flag
  workFromHome: {
    type: Boolean,
    default: false
  },
  
  // Late arrival reason
  lateReason: {
    type: String,
    default: null
  },
  
  // Approved by manager
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Approval status
  isApproved: {
    type: Boolean,
    default: true
  },
  
  // Department (for quick queries)
  department: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
attendanceSchema.index({ employee: 1, date: -1 }, { unique: true });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ department: 1, date: -1 });
attendanceSchema.index({ status: 1, date: -1 });

// Virtual for checking if employee is late
attendanceSchema.virtual('isLate').get(function() {
  return this.checkIn && this.checkIn.status === CheckInStatus.LATE;
});

// Virtual for checking if employee worked overtime
attendanceSchema.virtual('hasOvertime').get(function() {
  return this.overtime > 0;
});

// Method to calculate work duration
attendanceSchema.methods.calculateDuration = function() {
  if (this.checkIn && this.checkIn.time && this.checkOut && this.checkOut.time) {
    const checkInTime = new Date(this.checkIn.time);
    const checkOutTime = new Date(this.checkOut.time);
    const diffMs = checkOutTime - checkInTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    this.duration = Math.round(diffHours * 100) / 100;
    
    // Calculate overtime if worked more than expected
    if (this.duration > this.expectedHours) {
      this.overtime = Math.round((this.duration - this.expectedHours) * 100) / 100;
    } else {
      this.overtime = 0;
    }
    
    return this.duration;
  }
  return 0;
};

// Method to check in
attendanceSchema.methods.checkInEmployee = function(checkInTime, location, notes) {
  const now = checkInTime || new Date();
  const workStartTime = new Date(now);
  workStartTime.setHours(9, 0, 0, 0); // 9:00 AM work start
  
  let status = CheckInStatus.ON_TIME;
  let lateReason = null;
  
  if (now > workStartTime) {
    const diffMinutes = (now - workStartTime) / (1000 * 60);
    if (diffMinutes > 120) {
      status = CheckInStatus.VERY_LATE;
    } else {
      status = CheckInStatus.LATE;
    }
  }
  
  this.checkIn = {
    time: now,
    status: status,
    location: location || 'Office',
    notes: notes || null
  };
  
  // Update attendance status
  if (status === CheckInStatus.LATE || status === CheckInStatus.VERY_LATE) {
    this.status = AttendanceStatus.LATE;
    this.lateReason = notes;
  }
  
  return this;
};

// Method to check out
attendanceSchema.methods.checkOutEmployee = function(checkOutTime, location, notes) {
  const now = checkOutTime || new Date();
  
  this.checkOut = {
    time: now,
    location: location || 'Office',
    notes: notes || null
  };
  
  // Calculate duration
  this.calculateDuration();
  
  return this;
};

// Static method to get today's attendance
attendanceSchema.statics.getTodayAttendance = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.find({
    date: { $gte: today, $lt: tomorrow }
  }).populate('employee', 'name email department');
};

// Static method to get attendance by employee and date range
attendanceSchema.statics.getAttendanceByEmployee = async function(employeeId, startDate, endDate) {
  const query = { employee: employeeId };
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('employee', 'name email department')
    .sort({ date: -1 });
};

// Static method to get department attendance stats
attendanceSchema.statics.getDepartmentStats = async function(department, startDate, endDate) {
  const query = { department };
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }
  
  const attendances = await this.find(query);
  
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
      : 0
  };
  
  return stats;
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = { 
  Attendance, 
  AttendanceStatus, 
  CheckInStatus 
};
