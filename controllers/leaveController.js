const mongoose = require('mongoose');
const { LeaveRequest, LeaveType, LeaveStatus } = require('../models/LeaveRequest');

const { User } = require('../models/User');
const { Attendance } = require('../models/Attendance');

const { Notification } = require('../models/Notification');
const { NotificationType } = require('../models/Notification');
const { calculateCompensation, checkFinancialOverlap, syncCompensationToPayroll } = require('../services/compensationService');
const crypto = require('crypto');

const LEAVE_LABELS = {
  annual: 'إجازة سنوية', sick: 'إجازة مرضية', exceptional: 'إجازة استثنائية',
  death: 'إجازة وفاة', hourly: 'إجازة ساعية', emergency: 'إجازة طارئة',
  unpaid: 'إجازة بدون راتب', maternity: 'إجازة وضع', paternity: 'إجازة أبوة',
  compensatory: 'إجازة تعويضية', mission: 'مأمورية', overtime: 'أجر إضافي',
  attendance_correction: 'تصحيح بصمة',
};
const leaveLabel = (type) => LEAVE_LABELS[type] || type;

const emitSocket = (userId, notification) => {
  try { if (global.io) global.io.to(userId.toString()).emit('notification', notification); } catch (e) {}
};

const notifyManager = async (employeeId, leaveRequest) => {
  try {
    const employee = await User.findById(employeeId);
    if (!employee || !employee.department) return;
    const manager = await User.findOne({ role: 'manager', department: employee.department, isActive: true });
    if (manager) {
      const notif = await Notification.createNotification(
        manager._id, NotificationType.LEAVE_REQUESTED,
        'طلب إجازة جديد',
        `تقديم ${employee.name} بطلب ${leaveLabel(leaveRequest.type)}${leaveRequest.startDate ? ' من ' + leaveRequest.startDate.toLocaleDateString('ar-EG') : ''}${leaveRequest.endDate ? ' إلى ' + leaveRequest.endDate.toLocaleDateString('ar-EG') : ''}`,
        leaveRequest._id
      );
      emitSocket(manager._id, notif);
    }
  } catch (e) { console.error('notifyManager error:', e.message); }
};

const notifyAdmin = async (leaveRequest) => {
  try {
    const admin = await User.findOne({ role: 'admin', isActive: true });
    if (admin) {
      const employee = await User.findById(leaveRequest.employee);
      const notif = await Notification.createNotification(
        admin._id, NotificationType.LEAVE_NEEDS_GM,
        'طلب إجازة يحتاج موافقة المدير العام',
        `طلب إجازة ${leaveLabel(leaveRequest.type)} للموظف ${employee?.name} (أكثر من 3 أيام) يحتاج موافقتك`,
        leaveRequest._id
      );
      emitSocket(admin._id, notif);
    }
  } catch (e) { console.error('notifyAdmin error:', e.message); }
};

const notifyHR = async (leaveRequest) => {
  try {
    const hr = await User.findOne({ role: 'manager', department: 'hr', isActive: true });
    if (hr) {
      const employee = await User.findById(leaveRequest.employee);
      const notif = await Notification.createNotification(
        hr._id, NotificationType.LEAVE_APPROVED,
        'تمت الموافقة على إجازة',
        `تمت الموافقة على إجازة ${leaveLabel(leaveRequest.type)} للموظف ${employee?.name}`,
        leaveRequest._id
      );
      emitSocket(hr._id, notif);
    }
  } catch (e) { console.error('notifyHR error:', e.message); }
};

const approveWithPayrollSync = async (leaveRequest, req) => {
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

    if (leaveRequest.startDate && leaveRequest.endDate && ['annual', 'sick', 'emergency', 'exceptional', 'death', 'maternity', 'paternity', 'unpaid'].includes(leaveRequest.type)) {
      const current = new Date(leaveRequest.startDate);
      const end = new Date(leaveRequest.endDate);
      while (current <= end) {
        if (current.getDay() !== 5 && current.getDay() !== 6) {
          const dayStart = new Date(current); dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(current); dayEnd.setHours(23, 59, 59, 999);
          const existing = await Attendance.findOne({
            employee: leaveRequest.employee._id,
            date: { $gte: dayStart, $lt: dayEnd }
          }).session(session);
          if (!existing) {
            await Attendance.create([{
              employee: leaveRequest.employee._id, date: new Date(current),
              department: leaveRequest.employee.department,
              status: 'on_leave', leave: leaveRequest._id,
              expectedHours: 8, duration: leaveRequest.isHalfDay ? 4 : 8,
            }], { session });
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }

    await session.commitTransaction();
  } catch (syncErr) {
    await session.abortTransaction();
    console.error('Atomic payroll sync failed:', syncErr);
    throw syncErr;
  } finally {
    session.endSession();
  }
};

const createLeaveRequest = async (req, res) => {
  try {
    const { type, startDate, endDate, startTime, endTime, isHalfDay, reason, documents, coveragePlan } = req.body;
    const employeeId = req.user._id;

    if (!type || !reason) return res.status(400).json({ success: false, message: 'يرجى ملء جميع الحقول المطلوبة' });
    const employee = await User.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    if (!employee.isActive) return res.status(403).json({ success: false, message: 'لا يمكن تقديم طلب لحساب غير نشط' });

    const leaveRequest = new LeaveRequest({
      employee: employeeId, type, reason, documents: documents || [], department: employee.department,
      coveragePlan,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      startTime, endTime, isHalfDay: isHalfDay || false,
      idempotencyKey: crypto.randomUUID(),
    });

    if (startDate && endDate) leaveRequest.calculateDays();
    if (startTime && endTime) leaveRequest.calculateHours();

    if (['annual', 'hourly'].includes(type)) {
      const bal = await LeaveRequest.checkLeaveBalance(employeeId, type);
      if (type === 'annual' && leaveRequest.days > bal.remainingBalance)
        return res.status(400).json({ success: false, message: 'رصيد الإجازات غير كافٍ. المتاح: ' + bal.remainingBalance + ' أيام' });
    }

    if (startDate) {
      const end = endDate || startDate;
      const overlap = await checkFinancialOverlap(employeeId, startDate, end, null, { requestType: type });
      if (overlap.hasOverlap)
        return res.status(400).json({ success: false, message: overlap.conflicts.map(c => c.reason).join('; ') });
    }

    leaveRequest.status = LeaveStatus.PENDING_MANAGER;
    await leaveRequest.save();

    await notifyManager(employeeId, leaveRequest);

    res.status(201).json({ success: true, message: 'تم تقديم طلب الإجازة بنجاح', data: { leaveRequest } });
  } catch (error) {
    console.error('Error creating leave:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في تقديم الطلب' });
  }
};

const updateLeaveRequestStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'الحالة مطلوبة' });

    const leaveRequest = await LeaveRequest.findById(req.params.id).populate('employee', 'name email department');
    if (!leaveRequest) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });

    const prevStatus = leaveRequest.status;
    const isManager = req.user.role === 'manager';
    const isAdmin = req.user.role === 'admin';

    if (status === LeaveStatus.REJECTED) {
      if (isManager || isAdmin) {
        if (isManager && leaveRequest.status === LeaveStatus.PENDING_MANAGER && leaveRequest.department !== req.user.department)
          return res.status(403).json({ success: false, message: 'غير مصرح لك' });
        leaveRequest.status = LeaveStatus.REJECTED;
        leaveRequest.rejectionReason = rejectionReason || '';
        leaveRequest.approvedBy = req.user._id;
        leaveRequest.approvedAt = new Date();
        await leaveRequest.save();

        const rejectNotif = await Notification.createNotification(
          leaveRequest.employee._id, NotificationType.LEAVE_REJECTED,
          'تم رفض طلب الإجازة',
          `تم رفض طلب ${leaveLabel(leaveRequest.type)}${rejectionReason ? '. السبب: ' + rejectionReason : ''}`,
          leaveRequest._id
        );
        emitSocket(leaveRequest.employee._id, rejectNotif);

        return res.json({ success: true, message: 'تم الرفض', data: { leaveRequest } });
      }
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }

    if (status === LeaveStatus.APPROVED) {
      if (isManager && leaveRequest.status === LeaveStatus.PENDING_MANAGER) {
        if (leaveRequest.department !== req.user.department)
          return res.status(403).json({ success: false, message: 'غير مصرح لك - هذا الموظف ليس في قسمك' });

        leaveRequest.approvedBy = req.user._id;
        leaveRequest.approvedAt = new Date();

        if (leaveRequest.days > 3) {
          leaveRequest.status = LeaveStatus.PENDING_GENERAL_MANAGER;
          await leaveRequest.save();
          await notifyAdmin(leaveRequest);
          const pendingGmNotif = await Notification.createNotification(
            leaveRequest.employee._id, NotificationType.LEAVE_PENDING_GM,
            'طلب الإجازة بانتظار موافقة المدير العام',
            `طلب ${leaveLabel(leaveRequest.type)} (${leaveRequest.days} أيام) تمت موافقة مدير القسم وهو بانتظار موافقة المدير العام`,
            leaveRequest._id
          );
          emitSocket(leaveRequest.employee._id, pendingGmNotif);
          return res.json({ success: true, message: 'تمت الموافقة المبدئية. الطلب بانتظار موافقة المدير العام', data: { leaveRequest } });
        } else {
          leaveRequest.status = LeaveStatus.APPROVED;
          await approveWithPayrollSync(leaveRequest, req);

          const approvedNotif = await Notification.createNotification(
            leaveRequest.employee._id, NotificationType.LEAVE_APPROVED,
            'تمت الموافقة على طلب الإجازة',
            `تمت الموافقة على طلب ${leaveLabel(leaveRequest.type)} من ${leaveRequest.startDate?.toLocaleDateString('ar-EG')} إلى ${leaveRequest.endDate?.toLocaleDateString('ar-EG')}`,
            leaveRequest._id
          );
          emitSocket(leaveRequest.employee._id, approvedNotif);
          await notifyHR(leaveRequest);

          return res.json({ success: true, message: 'تمت الموافقة على طلب الإجازة', data: { leaveRequest } });
        }
      }

      if (isAdmin && leaveRequest.status === LeaveStatus.PENDING_GENERAL_MANAGER) {
        leaveRequest.status = LeaveStatus.APPROVED;
        leaveRequest.approvedBy = req.user._id;
        leaveRequest.approvedAt = new Date();
        await approveWithPayrollSync(leaveRequest, req);

        const gmApprovedNotif = await Notification.createNotification(
          leaveRequest.employee._id, NotificationType.LEAVE_APPROVED,
          'تمت الموافقة على طلب الإجازة',
          `تمت الموافقة النهائية على طلب ${leaveLabel(leaveRequest.type)} من ${leaveRequest.startDate?.toLocaleDateString('ar-EG')} إلى ${leaveRequest.endDate?.toLocaleDateString('ar-EG')}`,
          leaveRequest._id
        );
        emitSocket(leaveRequest.employee._id, gmApprovedNotif);
        await notifyHR(leaveRequest);

        return res.json({ success: true, message: 'تمت الموافقة النهائية على طلب الإجازة', data: { leaveRequest } });
      }

      if (isAdmin && leaveRequest.status === LeaveStatus.PENDING_MANAGER) {
        leaveRequest.status = LeaveStatus.APPROVED;
        leaveRequest.approvedBy = req.user._id;
        leaveRequest.approvedAt = new Date();
        await approveWithPayrollSync(leaveRequest, req);

        const adminApprovedNotif = await Notification.createNotification(
          leaveRequest.employee._id, NotificationType.LEAVE_APPROVED,
          'تمت الموافقة على طلب الإجازة',
          `تمت الموافقة على طلب ${leaveLabel(leaveRequest.type)}`,
          leaveRequest._id
        );
        emitSocket(leaveRequest.employee._id, adminApprovedNotif);
        await notifyHR(leaveRequest);

        return res.json({ success: true, message: 'تمت الموافقة', data: { leaveRequest } });
      }

      return res.status(400).json({ success: false, message: 'لا يمكن تحديث الحالة الآن' });
    }

    return res.status(400).json({ success: false, message: 'حالة غير صالحة' });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحديث الحالة' });
  }
};

const cancelLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id).populate('employee', 'name email department');
    if (!leaveRequest) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    const isOwner = leaveRequest.employee._id.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    if (!['draft', 'pending_manager', 'pending_general_manager', 'approved', 'synced_to_payroll'].includes(leaveRequest.status))
      return res.status(400).json({ success: false, message: 'لا يمكن إلغاء الطلب بعد المعالجة' });
    const wasApproved = leaveRequest.status === LeaveStatus.APPROVED || leaveRequest.status === 'synced_to_payroll';
    leaveRequest.status = LeaveStatus.CANCELLED;
    await leaveRequest.save();

    if (wasApproved) {
      try {
        await Attendance.deleteMany({ leave: leaveRequest._id });
      } catch (e) { console.error('Error cleaning attendance on cancel:', e.message); }
      try {
        const PayrollItem = mongoose.model('PayrollItem');
        await PayrollItem.updateMany(
          { sourceModel: 'LeaveRequest', sourceId: leaveRequest._id, status: 'active' },
          { $set: { status: 'cancelled' } }
        );
      } catch (e) { console.error('Error cancelling payroll items:', e.message); }
    }

    if (isOwner && leaveRequest.department) {
      try {
        const manager = await User.findOne({ role: 'manager', department: leaveRequest.department, isActive: true });
        if (manager) {
          const cancelNotif = await Notification.createNotification(
            manager._id, NotificationType.LEAVE_CANCELLED,
            'تم إلغاء إجازة من قبل الموظف',
            `ألغى ${leaveRequest.employee?.name} طلب ${leaveLabel(leaveRequest.type)}${leaveRequest.startDate ? ' من ' + leaveRequest.startDate.toLocaleDateString('ar-EG') : ''}${leaveRequest.endDate ? ' إلى ' + leaveRequest.endDate.toLocaleDateString('ar-EG') : ''}`,
            leaveRequest._id
          );
          emitSocket(manager._id, cancelNotif);
        }
      } catch (e) { console.error('notifyManagerOnCancel error:', e.message); }
    }

    res.json({ success: true, message: 'تم إلغاء الطلب بنجاح', data: { leaveRequest } });
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
    let leaveRequests;
    if (req.user.role === 'manager') {
      leaveRequests = await LeaveRequest.find({
        status: LeaveStatus.PENDING_MANAGER,
        department: req.user.department,
      }).populate('employee', 'name email department').sort({ createdAt: -1 });
    } else if (req.user.role === 'admin') {
      leaveRequests = await LeaveRequest.find({
        status: { $in: [LeaveStatus.PENDING_MANAGER, LeaveStatus.PENDING_GENERAL_MANAGER] },
      }).populate('employee', 'name email department').sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ success: false, message: 'غير مصرح' });
    }
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
      const hrDepts = ['hr', 'الموارد البشرية', 'موارد بشرية'];
      if (!hrDepts.includes((req.user.department || '').toLowerCase().trim())) {
        query.department = req.user.department;
      }
    }
    if (status) {
      if (status === 'pending') {
        query.status = { $in: ['pending', 'pending_manager', 'pending_general_manager'] };
      } else {
        query.status = status;
      }
    }
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
    res.json({
      success: true, data: {
        requests: leaveRequests, count: leaveRequests.length,
        total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit))
      }
    });
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

const validateLeaveRequest = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.body;
    const errors = [];
    if (!type) errors.push('نوع الإجازة مطلوب');
    if (!startDate) errors.push('تاريخ البداية مطلوب');
    if (['annual', 'sick', 'emergency', 'exceptional', 'death', 'maternity', 'unpaid'].includes(type) && !endDate)
      errors.push('تاريخ النهاية مطلوب');
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
