/**
 * Leave Request Controller
 * Extended: hourly, mission, overtime, attendance correction support
 */
const mongoose = require('mongoose');
const { LeaveRequest, LeaveType, LeaveStatus } = require('../models/LeaveRequest');
const { PayrollItem, PayrollItemType } = require('../models/PayrollItem');
const { User } = require('../models/User');
const { Attendance } = require('../models/Attendance');
const { AuditLog, AuditAction } = require('../models/AuditLog');
const { Notification } = require('../models/Notification');
const { calculateCompensation, checkFinancialOverlap, syncCompensationToPayroll } = require('../services/compensationService');
const crypto = require('crypto');

// ──────────────────────────────────────────────
// CREATE LEAVE REQUEST (ALL TYPES)
// ──────────────────────────────────────────────
const createLeaveRequest = async (req, res) => {
  try {
    const { type, startDate, endDate, startTime, endTime, isHalfDay, reason, documents, coveragePlan, missionType, visitParty, geoLocation, transportAllowance, overtimeHours } = req.body;
    const employeeId = req.user._id;

    if (!type || !reason) return res.status(400).json({ success: false, message: 'يرجى ملء جميع الحقول المطلوبة' });
    const employee = await User.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    if (!employee.isActive) return res.status(403).json({ success: false, message: 'لا يمكن تقديم طلب لحساب غير نشط' });

    const leaveRequest = new LeaveRequest({
      employee: employeeId, type, reason, documents: documents || [], department: employee.department,
      coveragePlan, missionType, visitParty, geoLocation, transportAllowance, overtimeHours,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      startTime, endTime, isHalfDay: isHalfDay || false,
      idempotencyKey: crypto.randomUUID(),
    });

    if (startDate && endDate) leaveRequest.calculateDays();
    if (startTime && endTime) leaveRequest.calculateHours();

    // Balance & overlap validation
    if (['annual', 'hourly'].includes(type)) {
      const bal = await LeaveRequest.checkLeaveBalance(employeeId, type);
      if (type === 'annual' && leaveRequest.days > bal.remainingBalance)
        return res.status(400).json({ success: false, message: 'رصيد الإجازات غير كافٍ. المتاح: ' + bal.remainingBalance + ' أيام' });
    }

    // Financial overlap check for overtime and leave
    if (startDate) {
      const end = endDate || startDate;
      const overlap = await checkFinancialOverlap(employeeId, startDate, end, null, { requestType: type });
      if (overlap.hasOverlap)
        return res.status(400).json({ success: false, message: overlap.conflicts.map(c => c.reason).join('; ') });
    }

    // Overtime amount estimation
    if (type === 'overtime' && overtimeHours) {
      const comp = await calculateCompensation({
        employeeId, requestType: 'overtime', hours: overtimeHours, executionDate: startDate || new Date(),
      });
      leaveRequest.estimatedAmount = comp.amount;
      leaveRequest.compensationResult = comp;
    }

    // Mission amount estimation
    if (type === 'mission') {
      const comp = await calculateCompensation({
        employeeId, requestType: 'mission', missionType, fixedAllowance: transportAllowance,
      });
      leaveRequest.estimatedAmount = comp.amount;
      leaveRequest.compensationResult = comp;
    }

    leaveRequest.status = LeaveStatus.PENDING_MANAGER;
    await leaveRequest.save();

    // ─── Audit Log ───
    try {
      const auditAction = status === LeaveStatus.REJECTED ? AuditAction.REJECT : AuditAction.APPROVE;
      await AuditLog.logAction({
        user: req.user._id,
        userRole: req.user.role,
        userDepartment: req.user.department,
        action: auditAction,
        entity: 'LeaveRequest',
        entityId: leaveRequest._id,
        details: {
          type: leaveRequest.type,
          prevStatus,
          newStatus: status,
          employeeId: leaveRequest.employee._id?.toString(),
          employeeName: leaveRequest.employee?.name,
          reason: leaveRequest.reason,
        },
        previousValues: { status: prevStatus },
        newValues: { status, rejectionReason },
        ipAddress: req.ip,
        notes: status === LeaveStatus.REJECTED ? 'السبب: ' + (rejectionReason || 'غير محدد') : 'تمت الموافقة على طلب الإجازة',
      });
    } catch (logErr) {
      console.error('Audit log error (non-critical):', logErr.message);
    }

    // ─── On FINAL APPROVAL: sync to payroll (atomic transaction) ───
    if (status === LeaveStatus.APPROVED || status === LeaveStatus.SYNCED_TO_PAYROLL) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        let comp;
        if (leaveRequest.type === 'mission') {
          comp = await calculateCompensation({
            employeeId: leaveRequest.employee._id, requestType: 'mission',
            missionType: leaveRequest.missionType, fixedAllowance: leaveRequest.transportAllowance,
          });
        } else if (leaveRequest.type === 'overtime') {
          comp = await calculateCompensation({
            employeeId: leaveRequest.employee._id, requestType: 'overtime',
            hours: leaveRequest.overtimeHours, executionDate: leaveRequest.startDate,
          });
        } else if (leaveRequest.type === 'unpaid') {
          comp = await calculateCompensation({
            employeeId: leaveRequest.employee._id, requestType: 'unpaid',
            days: leaveRequest.days,
          });
        } else if (leaveRequest.type === 'hourly') {
          comp = await calculateCompensation({
            employeeId: leaveRequest.employee._id, requestType: 'hourly',
            hours: leaveRequest.hours || leaveRequest.days * 8,
          });
        }

        if (comp && (comp.amount !== 0 || comp.isDeduction)) {
          const pi = await syncCompensationToPayroll(
            comp, leaveRequest.type, leaveRequest._id, leaveRequest.employee._id,
            'LR-' + leaveRequest._id.toString(),
            { session, createdBy: req.user._id, description: leaveRequest.reason }
          );
          leaveRequest.payrollItemId = pi._id;
          leaveRequest.compensationResult = comp;
        }

        await leaveRequest.save({ session });

        // Create attendance records for leave days (within same transaction)
        if (leaveRequest.startDate && leaveRequest.endDate && ['annual', 'sick', 'emergency', 'maternity', 'paternity', 'unpaid'].includes(leaveRequest.type)) {
          const current = new Date(leaveRequest.startDate);
          const end = new Date(leaveRequest.endDate);
          while (current <= end) {
            if (current.getDay() !== 5 && current.getDay() !== 6) {
              const existing = await Attendance.findOne({ employee: leaveRequest.employee._id, date: { '$gte': new Date(current.setHours(0, 0, 0, 0)), '$lt': new Date(current.setHours(23, 59, 59, 999)) } }).session(session);
              if (!existing) {
                await Attendance.create([{
                  employee: leaveRequest.employee._id, date: new Date(current), department: leaveRequest.employee.department,
                  status: 'on_leave', leave: leaveRequest._id, expectedHours: 8, duration: leaveRequest.isHalfDay ? 4 : 8,
                }], { session });
              }
            }
            current.setDate(current.getDate() + 1);
          }
        }

        await session.commitTransaction();
      } catch (syncErr) {
        await session.abortTransaction();
        console.error('Atomic payroll sync failed, transaction rolled back:', syncErr);
        return res.status(500).json({ success: false, message: 'فشلت مزامنة الراتب، تم التراجع عن العملية' });
      } finally {
        session.endSession();
      }
    }

    // Notification
    const nt = status === LeaveStatus.APPROVED ? 'leave_approved' : 'leave_rejected';
    const nTitle = status === LeaveStatus.APPROVED ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب';
    await Notification.createNotification(leaveRequest.employee._id, nt, nTitle,
      (status === LeaveStatus.APPROVED ? 'تمت الموافقة على ' : 'تم رفض ') + leaveRequest.type +
      (leaveRequest.startDate ? (' من ' + leaveRequest.startDate.toLocaleDateString('ar-EG')) : '') +
      (status === LeaveStatus.REJECTED ? ('. السبب: ' + (rejectionReason || 'غير محدد')) : ''), leaveRequest._id);

    res.json({ success: true, message: status === LeaveStatus.APPROVED ? 'تمت الموافقة' : 'تم الرفض', data: { leaveRequest } });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحديث الحالة' });
  }
};

const cancelLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    if (leaveRequest.employee.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    if (!['draft', 'pending_manager'].includes(leaveRequest.status))
      return res.status(400).json({ success: false, message: 'لا يمكن إلغاء الطلب بعد المعالجة' });
    leaveRequest.status = LeaveStatus.CANCELLED;
    await leaveRequest.save();
    res.json({ success: true, message: 'تم إلغاء الطلب بنجاح' });
  } catch (error) {
    console.error('Error cancelling:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الإلغاء' });
  }
};

const getLeaveBalance = async (req, res) => {
  try {
    const employeeId = req.user._id;
    const balances = {};
    for (const key in LeaveType) {
      balances[LeaveType[key]] = await LeaveRequest.checkLeaveBalance(employeeId, LeaveType[key]);
    }
    res.json({ success: true, data: { balances } });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الرصيد' });
  }
};

const getPendingLeaveRequests = async (req, res) => {
  try {
    const query = { status: LeaveStatus.PENDING_MANAGER };
    if (req.user.role === 'manager') query.department = req.user.department;
    const leaveRequests = await LeaveRequest.find(query).populate('employee', 'name email department').sort({ createdAt: -1 });
    res.json({ success: true, data: { leaveRequests, count: leaveRequests.length } });
  } catch (error) {
    console.error('Error getting pending:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الطلبات المعلقة' });
  }
};

const getDepartmentLeaveCalendar = async (req, res) => {
  try {
    const { department } = req.params;
    const { startDate, endDate } = req.query;
    if (req.user.role === 'manager' && req.user.department !== department)
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(new Date().setMonth(new Date().getMonth() + 1));
    const leaves = await LeaveRequest.getDepartmentLeaveCalendar(department, start, end);
    res.json({ success: true, data: { leaves } });
  } catch (error) {
    console.error('Error getting calendar:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التقويم' });
  }
};

const getLeaveRequests = async (req, res) => {
  try {
    const { status, employeeId, startDate, endDate, type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (req.user.role === 'employee') {
      query.employee = req.user._id;
    } else if (employeeId) {
      query.employee = employeeId;
    } else if (req.user.role === 'manager') {
      query.department = req.user.department;
    }
    if (status) query.status = status;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.endDate = { $lte: new Date(endDate) };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const leaveRequests = await LeaveRequest.find(query)
      .populate('employee', 'name email department')
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await LeaveRequest.countDocuments(query);
    res.json({ success: true, data: { requests: leaveRequests, count: leaveRequests.length, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    console.error('Error getting leave requests:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب طلبات الإجازة' });
  }
};

const getLeaveRequestById = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id).populate('employee', 'name email department');
    if (!leaveRequest) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    if (req.user.role === 'employee' && leaveRequest.employee._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'غير مصرح' });
    res.json({ success: true, data: { leaveRequest } });
  } catch (error) {
    console.error('Error getting leave request:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الطلب' });
  }
};

const updateLeaveRequestStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'الحالة مطلوبة' });
    const leaveRequest = await LeaveRequest.findById(req.params.id).populate('employee', 'name email department');
    if (!leaveRequest) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    if (req.user.role === 'manager') {
      const allowed = ['pending_manager', 'pending_gm'];
      if (!allowed.includes(leaveRequest.status)) return res.status(400).json({ success: false, message: 'لا يمكن تحديث الحالة الآن' });
      if (leaveRequest.department !== req.user.department) return res.status(403).json({ success: false, message: 'غير مصرح' });
    }
    const prevStatus = leaveRequest.status;
    leaveRequest.status = status;
    leaveRequest.rejectionReason = rejectionReason || '';
    leaveRequest.approvedBy = req.user._id;
    leaveRequest.approvedAt = new Date();
    await leaveRequest.save();
    res.json({ success: true, message: 'تم تحديث الحالة', data: { leaveRequest } });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحديث الحالة' });
  }
};

const validateLeaveRequest = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.body;
    const errors = [];
    if (!type) errors.push('نوع الإجازة مطلوب');
    if (!startDate) errors.push('تاريخ البداية مطلوب');
    if (['annual', 'sick', 'emergency', 'maternity', 'unpaid'].includes(type) && !endDate) errors.push('تاريخ النهاية مطلوب');
    if (errors.length > 0) return res.status(400).json({ success: false, message: errors.join('; '), errors });
    const balance = await LeaveRequest.checkLeaveBalance(req.user._id, type);
    res.json({ success: true, data: { valid: true, balance } });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في التحقق' });
  }
};

module.exports = {
  createLeaveRequest, validateLeaveRequest, getLeaveRequests, getLeaveRequestById,
  updateLeaveStatus: updateLeaveRequestStatus, cancelLeaveRequest,
  getLeaveBalance, getPendingLeaveRequests, getDepartmentLeaveCalendar,
};