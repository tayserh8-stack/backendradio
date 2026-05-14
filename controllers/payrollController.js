/**
 * Payroll Controller
 * Handles payroll, payslip, and financial management operations
 */

const { Payroll, PayrollStatus } = require('../models/Payroll');
const crypto = require('crypto');
const { User } = require('../models/User');
const { Notification, NotificationType } = require('../models/Notification');

let AuditLog, AuditAction;
try {
  const auditModule = require('../models/AuditLog');
  AuditLog = auditModule.AuditLog;
  AuditAction = auditModule.AuditAction;
} catch (e) {
  console.warn('AuditLog model not available, audit logging disabled');
}

// ========================================================================
// UTILITY FUNCTIONS
// ========================================================================

/**
 * Safe numeric parser - prevents NaN propagation
 */
const safeNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Send JSON error response with consistent format
 */
const sendError = (res, statusCode, message, details = undefined) => {
  const response = {
    success: false,
    message
  };
  // Only include error details in development
  if (process.env.NODE_ENV === 'development' && details) {
    response.error = details;
  }
  return res.status(statusCode).json(response);
};

/**
 * Validate payroll existence or return 404
 */
const getPayrollOr404 = async (id) => {
  const payroll = await Payroll.findById(id);
  if (!payroll) {
    return { error: 'الراتب غير موجود', status: 404 };
  }
  return { payroll };
};

/**
 * Safely calculate gross from components (matches frontend calculation)
 */
const calculateGrossFromComponents = (baseSalary, allowances = [], bonuses = [], overtime = {}) => {
  const base = safeNumber(baseSalary);
  const allowancesSum = (allowances || []).reduce((sum, a) => sum + safeNumber(a.amount), 0);
  const bonusesSum = (bonuses || []).reduce((sum, b) => sum + safeNumber(b.amount), 0);
  const overtimeHours = safeNumber(overtime?.hours);
  const overtimeRate = safeNumber(overtime?.hourlyRate);
  const overtimeAmount = safeNumber(overtime?.totalAmount) || (overtimeHours * overtimeRate);

  return base + allowancesSum + bonusesSum + overtimeAmount;
};

/**
 * Calculate daily rate from monthly salary (safe division)
 */
const calculateDailyRate = (monthlySalary, workingDays = 22) => {
  const salary = safeNumber(monthlySalary);
  const days = safeNumber(workingDays, 22);
  return days > 0 ? salary / days : 0;
};

/**
 * Get payroll for employee (employee access)
 * GET /api/payroll/employee/:employeeId
 */
const getPayrollByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Validate employeeId format
    if (!employeeId || !employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      return sendError(res, 400, 'معرف الموظف غير صالح');
    }

    // Check if user can view this employee's payroll
    if (req.user.role === 'employee' && req.user._id.toString() !== employeeId) {
      return sendError(res, 403, 'ليس لديك صلاحية لعرض رواتب موظفين آخرين');
    }

    const query = { employee: employeeId };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const payrolls = await Payroll.find(query)
      .sort({ periodEnd: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('approvedBy', 'name role')
      .populate('generatedBy', 'name role')
      .lean();

    // Filter out any orphaned records (defensive)
    const validPayrolls = (payrolls || []).filter(p => p && p.employee != null);

    const total = await Payroll.countDocuments(query);

    res.json({
      success: true,
      data: {
        payrolls: validPayrolls,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching payroll by employee:', error);
    return sendError(res, 500, 'خطأ في جلب الرواتب', error.message);
  }
};

/**
 * Generate payslip PDF/Document
 * GET /api/payroll/:id/payslip
 */
const generatePayslip = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendError(res, 400, 'معرف الراتب غير صالح');
    }

    const payroll = await Payroll.findById(id)
      .populate('employee', 'name username department email phone')
      .populate('approvedBy', 'name role');

    if (!payroll) {
      return sendError(res, 404, 'الراتب غير موجود');
    }

    // Check access
    const isEmployee = req.user.role === 'employee' && req.user._id.toString() === payroll.employee._id.toString();
    const isAuthorized = req.user.role === 'admin' || req.user.role === 'manager' || isEmployee;

    if (!isAuthorized) {
      return sendError(res, 403, 'ليس لديك صلاحية لعرض هذا الكشف');
    }

    // Safely extract components with defaults
    const allowances = Array.isArray(payroll.components?.allowances) ? payroll.components.allowances : [];
    const bonuses = Array.isArray(payroll.components?.bonuses) ? payroll.components.bonuses : [];
    const overtime = payroll.components?.overtime || { hours: 0, hourlyRate: 0, totalAmount: 0 };

    // Generate payslip data
    const payslipData = {
      payslipNumber: payroll.payslipNumber,
      companyInfo: {
        name: 'شركة إدارة الموارد البشرية',
        address: 'المقر الرئيسي',
        phone: 'ارقام التواصل'
      },
      employeeInfo: {
        name: payroll.employee?.name || 'غير معروف',
        username: payroll.employee?.username || '',
        department: payroll.employee?.department || 'غير محدد',
        email: payroll.employee?.email || '',
        phone: payroll.employee?.phone || ''
      },
      payrollInfo: {
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        paymentDate: payroll.paymentDate,
        frequency: payroll.frequency || 'monthly',
        workingDays: payroll.workingDays || 0,
        daysWorked: payroll.daysWorked || 0,
        baseSalary: payroll.baseSalary || 0
      },
      breakdown: {
        allowances,
        bonuses,
        overtime,
        absences: payroll.deductions?.absences || { days: 0, dailyRate: 0, totalAmount: 0 },
        latePenalties: payroll.deductions?.latePenalties || { occurrences: 0, amountPerOccurrence: 0, totalAmount: 0 },
        otherDeductions: payroll.deductions?.other || []
      },
      totals: payroll.totals || { gross: 0, deductions: 0, net: 0 },
      status: payroll.status || 'pending',
      approvedBy: payroll.approvedBy,
      generatedAt: new Date(),
      notes: payroll.notes || ''
    };

    // Mark as generated
    if (!payroll.payslipGenerated) {
      payroll.payslipGenerated = true;
      await payroll.save();
    }

    res.json({
      success: true,
      data: {
        payslip: payslipData
      }
    });
  } catch (error) {
    console.error('Error generating payslip:', error);
    return sendError(res, 500, 'خطأ في إنشاء الكشف', error.message);
  }
};

/**
 * Get all payrolls (admin/manager access)
 * GET /api/payroll/all
 */
const getAllPayrolls = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      department,
      month,
      year,
      employeeId
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (department && !employeeId) {
      const employees = await User.find({ department }).select('_id');
      if (employees.length === 0) {
        return res.json({
          success: true,
          data: {
            payrolls: [],
            pagination: {
              currentPage: parseInt(page),
              totalPages: 0,
              totalItems: 0
            }
          }
        });
      }
      query.employee = { $in: employees.map(e => e._id) };
    }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.periodStart = { $gte: startDate };
      query.periodEnd = { $lte: endDate };
    }

    if (employeeId) {
      query.employee = employeeId;
    }

    // Limit department managers to their department
    if (req.user.role === 'manager' && req.user.department) {
      const employees = await User.find({
        department: req.user.department
      }).select('_id');
      const employeeIds = employees.map(e => e._id);
      if (employeeIds.length === 0) {
        // Manager has no employees in department, return empty
        return res.json({
          success: true,
          data: {
            payrolls: [],
            pagination: {
              currentPage: parseInt(page),
              totalPages: 0,
              totalItems: 0
            }
          }
        });
      }
      query.employee = { $in: employeeIds };
    }

    const skip = (page - 1) * limit;

    // Fetch payrolls with population - select only needed fields
    const payrolls = await Payroll.find(query)
      .populate('employee', 'name department baseSalary email')
      .populate('approvedBy', 'name role')
      .populate('generatedBy', 'name role')
      .sort({ periodEnd: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Convert to plain objects for safer manipulation

    // ✅ FILTER OUT payrolls with missing/invalid employee references
    const validPayrolls = (payrolls || []).filter(payroll => {
      return payroll && payroll.employee !== null && payroll.employee !== undefined;
    });

    // Log warning if orphaned payrolls found
    if (payrolls.length !== validPayrolls.length) {
      console.warn(`[Payroll] Filtered out ${payrolls.length - validPayrolls.length} orphaned payroll records`);
    }

    const total = await Payroll.countDocuments(query);

    res.json({
      success: true,
      data: {
        payrolls: validPayrolls,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching all payrolls:', error);
    return sendError(res, 500, 'حدث خطأ في جلب الرواتب', process.env.NODE_ENV === 'development' ? error.message : undefined);
  }
};

/**
 * Get pending payroll entries requiring salary assignment (HR only)
 * GET /api/payroll/pending-assignments
 * Accessible by admin, super_admin, general_manager, and HR department managers
 */
const getPendingPayrollAssignments = async (req, res) => {
  try {
    // Access control: admin, super_admin, general_manager, or HR department manager
    const isHRManager = req.user.role === 'manager' && req.user.department &&
      ['human resources', 'hr', 'الموارد البشرية', 'م/ب'].some(
        keyword => (req.user.department || '').toLowerCase().includes(keyword)
      );

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'general_manager' && !isHRManager) {
      return sendError(res, 403, 'ليس لديك صلاحية لعرض قائمة الانتظار');
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * parseInt(limit);

    // Find payroll entries that are pending and need salary assignment
    const query = {
      isPendingSalaryAssignment: true,
      status: PayrollStatus.PENDING
    };

    const pendingPayrolls = await Payroll.find(query)
      .populate('employee', 'name username department email phone startDate') // Added username
      .populate('generatedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Convert to plain objects for safer manipulation

    // Filter out any orphaned payrolls (defensive)
    const validPendingPayrolls = (pendingPayrolls || []).filter(p => p.employee != null);

    if (pendingPayrolls.length !== validPendingPayrolls.length) {
      console.warn(`[Payroll] Filtered out ${pendingPayrolls.length - validPendingPayrolls.length} orphaned pending payroll records`);
    }

    const total = await Payroll.countDocuments(query);

    res.json({
      success: true,
      data: {
        pendingPayrolls: validPendingPayrolls,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching pending payroll assignments:', error);
    return sendError(res, 500, 'خطأ في جلب قائمة الانتظار', process.env.NODE_ENV === 'development' ? error.message : undefined);
  }
};

/**
 * Generate payroll (admin/manager access)
 * POST /api/payroll/generate
 */
const generatePayroll = async (req, res) => {
  try {
    const {
      employeeId,
      periodStart,
      periodEnd,
      paymentDate,
      frequency = 'monthly',
      baseSalary,
      workingDays,
      daysWorked,
      allowances = [],
      bonuses = [],
      overtime = {},
      absences = {},
      latePenalties = {},
      otherDeductions = [],
      notes = ''
    } = req.body;

    // Validate required fields
    if (!employeeId) {
      return sendError(res, 400, 'يجب تحديد الموظف');
    }

    // Verify employee exists and is active
    const employee = await User.findById(employeeId).select('name department baseSalary isActive');
    if (!employee) {
      return sendError(res, 404, 'الموظف غير موجود');
    }

    if (!employee.isActive) {
      return sendError(res, 400, 'لا يمكن إنشاء راتب لموظف غير نشط');
    }

    // Check department access for managers
    if (req.user.role === 'manager' && req.user.department !== employee.department) {
      return sendError(res, 403, 'لا يمكنك إنشاء رواتب لموظفين خارج قسمك');
    }

    // Validate dates
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const payDate = new Date(paymentDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(payDate.getTime())) {
      return sendError(res, 400, 'تاريخ غير صالح');
    }

    if (endDate < startDate) {
      return sendError(res, 400, 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    }

    // Use employee's base salary if not provided
    const finalBaseSalary = safeNumber(baseSalary) || safeNumber(employee.baseSalary) || 0;

    if (finalBaseSalary <= 0) {
      return sendError(res, 400, 'يجب إدخال راتب أساسي صحيح');
    }

    // Validate workingDays
    const validWorkingDays = safeNumber(workingDays, 22);
    if (validWorkingDays <= 0) {
      return sendError(res, 400, 'عدد أيام العمل يجب أن يكون أكبر من صفر');
    }

    // Calculate daily rate
    const dailyRate = calculateDailyRate(finalBaseSalary, validWorkingDays);

    // Sanitize arrays to prevent undefined access
    const safeAllowances = Array.isArray(allowances) ? allowances : [];
    const safeBonuses = Array.isArray(bonuses) ? bonuses : [];
    const safeOtherDeductions = Array.isArray(otherDeductions) ? otherDeductions : [];

    // Create payroll record
    const payroll = await Payroll.create({
      employee: employeeId,
      periodStart: startDate,
      periodEnd: endDate,
      paymentDate: payDate,
      frequency,
      baseSalary: finalBaseSalary,
      workingDays: validWorkingDays,
      daysWorked: safeNumber(daysWorked, 0),
      components: {
        allowances: safeAllowances.map(a => ({
          type: a.type || 'other',
          amount: safeNumber(a.amount),
          description: a.description || ''
        })),
        bonuses: safeBonuses.map(b => ({
          type: b.type || 'other',
          amount: safeNumber(b.amount),
          reason: b.reason || '',
          referenceId: b.referenceId || null
        })),
        overtime: {
          hours: safeNumber(overtime?.hours, 0),
          hourlyRate: safeNumber(overtime?.hourlyRate, finalBaseSalary / 176),
          totalAmount: 0 // Will be calculated in pre-save
        }
      },
      deductions: {
        absences: {
          days: safeNumber(absences?.days, 0),
          dailyRate: safeNumber(absences?.dailyRate, dailyRate),
          totalAmount: 0 // Will be calculated
        },
        latePenalties: {
          occurrences: safeNumber(latePenalties?.occurrences, 0),
          amountPerOccurrence: safeNumber(latePenalties?.amountPerOccurrence, 0),
          totalAmount: 0 // Will be calculated
        },
        other: safeOtherDeductions.map(d => ({
          type: d.type || 'other',
          amount: safeNumber(d.amount),
          description: d.description || ''
        }))
      },
      generatedBy: req.user._id,
      notes: notes || ''
    });

    // Calculate totals (triggered by pre-save hook)
    payroll.calculateTotals();
    await payroll.save();

    // Create audit log (non-critical)
    if (AuditLog) {
      try {
        await AuditLog.create({
          user: req.user._id,
          action: 'CREATE',
          entity: 'Payroll',
          entityId: payroll._id,
          details: {
            employee: employee.name,
            period: `${payroll.periodStart.toLocaleDateString()} - ${payroll.periodEnd.toLocaleDateString()}`,
            baseSalary: finalBaseSalary,
            gross: payroll.totals.gross,
            net: payroll.totals.net
          },
          previousValues: null,
          newValues: payroll.totals
        });
      } catch (logError) {
        console.error('Error creating audit log:', logError);
      }
    }

    // Send notification to employee
    try {
      await Notification.createNotification(
        employeeId,
        NotificationType.PAYROLL,
        '💰 تم إنشاء الراتب',
        `تم إنشاء راتب لشهرة ${new Date(payroll.periodEnd).toLocaleDateString('ar-EG')} - الصافي: ${payroll.totals.net}`,
        null
      );
    } catch (notifError) {
      console.error('Error sending payroll notification:', notifError);
    }

    res.json({
      success: true,
      message: 'تم إنشاء الراتب بنجاح',
      data: { payroll }
    });
  } catch (error) {
    console.error('Error generating payroll:', error);
    return sendError(res, 500, 'خطأ في إنشاء الراتب', error.message);
  }
};

/**
 * Update payroll (admin/manager access)
 * PUT /api/payroll/:id
 */
const updatePayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate id format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendError(res, 400, 'معرف الراتب غير صالح');
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return sendError(res, 404, 'الراتب غير موجود');
    }

    // Check if payroll is already paid (cannot edit paid payrolls)
    if (payroll.status === PayrollStatus.PAID) {
      return sendError(res, 403, 'لا يمكن تعديل راتب تم دفعه');
    }

    // Check department access for managers
    if (req.user.role === 'manager') {
      const employee = await User.findById(payroll.employee).select('department');
      if (!employee) {
        return sendError(res, 404, 'الموظف المرتبط بهذا الراتب غير موجود');
      }
      if (employee.department !== req.user.department) {
        return sendError(res, 403, 'لا يمكنك تعديل رواتب موظفي أقسام أخرى');
      }
    }

    // Store previous values for audit
    const previousValues = {
      baseSalary: payroll.baseSalary,
      totals: { ...payroll.totals },
      status: payroll.status
    };

    // Update allowed fields only (prevent _id and employee modification)
    const allowedUpdates = [
      'periodStart', 'periodEnd', 'paymentDate', 'frequency',
      'baseSalary', 'workingDays', 'daysWorked',
      'components', 'deductions',
      'paymentMethod', 'notes'
    ];

    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        // Sanitize nested objects if needed
        if (key === 'baseSalary') {
          payroll[key] = safeNumber(updates[key]);
        } else {
          payroll[key] = updates[key];
        }
      }
    });

    // Mark as needing recalculation if components changed
    if (updates.components || updates.deductions) {
      payroll.needsRecalculation = true;
    }

    // Recalculate totals (will run pre-save hook as well)
    payroll.calculateTotals();

    // Handle status change to APPROVED
    if (updates.status === PayrollStatus.APPROVED) {
      payroll.approvedBy = req.user._id;
      payroll.approvedAt = new Date();
    }

    await payroll.save();

    // Create audit log
    if (AuditLog) {
      try {
        await AuditLog.create({
          user: req.user._id,
          action: 'UPDATE',
          entity: 'Payroll',
          entityId: payroll._id,
          details: { employee: payroll.employee ? payroll.employee.toString() : 'unknown' },
          previousValues,
          newValues: {
            baseSalary: payroll.baseSalary,
            totals: payroll.totals,
            status: payroll.status
          }
        });
      } catch (logError) {
        console.error('Error creating audit log:', logError);
      }
    }

    res.json({
      success: true,
      message: 'تم تحديث الراتب بنجاح',
      data: { payroll }
    });
  } catch (error) {
    console.error('Error updating payroll:', error);
    return sendError(res, 500, 'خطأ في تحديث الراتب', error.message);
  }
};

/**
 * Assign salary to pending payroll entry (HR only)
 * PUT /api/payroll/:id/assign-salary
 * This endpoint is specifically for HR to set base salary and finalize pending payroll entries
 */
const assignSalaryToPendingPayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const { baseSalary, allowances = [], bonuses = [], periodStart, periodEnd, paymentDate } = req.body;

    // Access control: admin, super_admin, general_manager, or HR department manager
    const isHRManager = req.user.role === 'manager' && req.user.department &&
      ['human resources', 'hr', 'الموارد البشرية', 'م/ب'].some(
        keyword => (req.user.department || '').toLowerCase().includes(keyword)
      );

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'general_manager' && !isHRManager) {
      return sendError(res, 403, 'ليس لديك صلاحية لتعديل بيانات الراتب');
    }

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendError(res, 400, 'معرف الراتب غير صالح');
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return sendError(res, 404, 'الراتب غير موجود');
    }

    // Verify this is a pending assignment entry
    if (!payroll.isPendingSalaryAssignment) {
      return sendError(res, 400, 'هذا الراتب ليس في حالة انتظار إدخال البيانات');
    }

    // Validate base salary - required and positive
    const finalBaseSalary = safeNumber(baseSalary);
    if (!finalBaseSalary || finalBaseSalary <= 0) {
      return sendError(res, 400, 'يجب إدخال راتب أساسي صحيح');
    }

    // Validate dates if provided
    let startDate, endDate, payDate;
    if (periodStart) {
      startDate = new Date(periodStart);
      if (isNaN(startDate.getTime())) {
        return sendError(res, 400, 'تاريخ البداية غير صالح');
      }
    }
    if (periodEnd) {
      endDate = new Date(periodEnd);
      if (isNaN(endDate.getTime())) {
        return sendError(res, 400, 'تاريخ النهاية غير صالح');
      }
    }
    if (paymentDate) {
      payDate = new Date(paymentDate);
      if (isNaN(payDate.getTime())) {
        return sendError(res, 400, 'تاريخ الدفع غير صالح');
      }
    }

    // Sanitize arrays
    const safeAllowances = Array.isArray(allowances) ? allowances : [];
    const safeBonuses = Array.isArray(bonuses) ? bonuses : [];

    // Update payroll with salary details
    payroll.baseSalary = finalBaseSalary;
    payroll.components.allowances = safeAllowances.map(a => ({
      type: a.type || 'other',
      amount: safeNumber(a.amount),
      description: a.description || ''
    }));
    if (safeBonuses.length > 0) {
      payroll.components.bonuses = safeBonuses.map(b => ({
        type: b.type || 'other',
        amount: safeNumber(b.amount),
        reason: b.reason || '',
        referenceId: b.referenceId || null
      }));
    }

    // Update period dates if provided
    if (startDate) payroll.periodStart = startDate;
    if (endDate) payroll.periodEnd = endDate;
    if (payDate) payroll.paymentDate = payDate;

    // Clear the pending flag - salary has been assigned
    payroll.isPendingSalaryAssignment = false;

    // Calculate totals with the new salary
    payroll.calculateTotals();

    // Keep as pending for approval workflow (or change as needed)
    payroll.status = PayrollStatus.PENDING;
    payroll.generatedBy = req.user._id;

    await payroll.save();

    // Update employee's base salary record to maintain data integrity
    try {
      await User.findByIdAndUpdate(payroll.employee, { baseSalary: finalBaseSalary });
      console.log(`✅ Updated baseSalary for employee ${payroll.employee} to ${finalBaseSalary}`);
    } catch (userUpdateError) {
      console.error('Error updating employee base salary:', userUpdateError);
      // Don't fail the whole operation, just log
    }

    // Create audit log
    if (AuditLog) {
      try {
        await AuditLog.create({
          user: req.user._id,
          action: 'UPDATE',
          entity: 'Payroll',
          entityId: payroll._id,
          details: {
            employee: payroll.employee ? payroll.employee.toString() : 'unknown',
            action: 'assign_salary',
            baseSalary: finalBaseSalary
          },
          previousValues: { baseSalary: null, status: 'pending_assignment' },
          newValues: { baseSalary: finalBaseSalary, status: 'pending' }
        });
      } catch (logError) {
        console.error('Error creating audit log:', logError);
      }
    }

    // Send notification to employee about payroll setup
    try {
      await Notification.createNotification(
        payroll.employee,
        NotificationType.PAYROLL,
        '💰 تم إعداد بيانات الراتب',
        `تم إعداد بيانات راتبك للشهر الحالي. الراتب الأساسي: ${finalBaseSalary} ريال.\nيرجى مراجعة تفاصيل الراتب.`,
        null
      );
    } catch (notifError) {
      console.error('Error sending payroll notification:', notifError);
    }

    res.json({
      success: true,
      message: 'تم إدخال بيانات الراتب بنجاح',
      data: { payroll }
    });
  } catch (error) {
    console.error('Error assigning salary to pending payroll:', error);
    return sendError(res, 500, 'خطأ في إدخال بيانات الراتب', error.message);
  }
};

/**
 * Approve payroll (admin only)
 * PUT /api/payroll/:id/approve
 */
const approvePayroll = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'general_manager') {
      return sendError(res, 403, 'الموافقة على الرواتب متاحة للمدير العام والمدير فقط');
    }

    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendError(res, 400, 'معرف الراتب غير صالح');
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return sendError(res, 404, 'الراتب غير موجود');
    }

    // Prevent approving already approved or paid payrolls
    if (payroll.status === PayrollStatus.APPROVED) {
      return sendError(res, 400, 'هذا الراتب موافق عليه بالفعل');
    }

    if (payroll.status === PayrollStatus.PAID) {
      return sendError(res, 400, 'لا يمكن الموافقة على راتب تم دفعه بالفعل');
    }

    const previousStatus = payroll.status;

    payroll.status = PayrollStatus.APPROVED;
    payroll.approvedBy = req.user._id;
    payroll.approvedAt = new Date();
    await payroll.save();

    // Create audit log
    if (AuditLog) {
      try {
        await AuditLog.create({
          user: req.user._id,
          action: 'APPROVE',
          entity: 'Payroll',
          entityId: payroll._id,
          details: { netSalary: payroll.totals?.net || 0 },
          previousValues: { status: previousStatus },
          newValues: { status: PayrollStatus.APPROVED }
        });
      } catch (logError) {
        console.error('Error creating audit log:', logError);
      }
    }

    res.json({
      success: true,
      message: 'تمت الموافقة على الراتب بنجاح',
      data: { payroll }
    });
  } catch (error) {
    console.error('Error approving payroll:', error);
    return sendError(res, 500, 'خطأ في الموافقة على الراتب', error.message);
  }
};

/**
 * Mark payroll as paid
 * PUT /api/payroll/:id/pay
 */
const markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, notes } = req.body;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendError(res, 400, 'معرف الراتب غير صالح');
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return sendError(res, 404, 'الراتب غير موجود');
    }

    if (payroll.status !== PayrollStatus.APPROVED) {
      return sendError(res, 403, 'يجب الموافقة على الراتب قبل الدفع');
    }

    payroll.status = PayrollStatus.PAID;
    payroll.paymentMethod = paymentMethod || payroll.paymentMethod;
    if (notes) {
      payroll.notes += `\n[${new Date().toLocaleDateString()}] ${notes}`;
    }
    await payroll.save();

    // Create audit log
    if (AuditLog) {
      try {
        await AuditLog.create({
          user: req.user._id,
          action: 'PAY',
          entity: 'Payroll',
          entityId: payroll._id,
          details: {
            paymentMethod: payroll.paymentMethod,
            amount: payroll.totals?.net || 0
          },
          previousValues: { status: PayrollStatus.APPROVED },
          newValues: { status: PayrollStatus.PAID }
        });
      } catch (logError) {
        console.error('Error creating audit log:', logError);
      }
    }

    res.json({
      success: true,
      message: 'تم تسجيل الدفع بنجاح',
      data: { payroll }
    });
  } catch (error) {
    console.error('Error marking payroll as paid:', error);
    return sendError(res, 500, 'خطأ في تسجيل الدفع', error.message);
  }
};

/**
 * Delete payroll (admin only)
 * DELETE /api/payroll/:id
 */
const deletePayroll = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return sendError(res, 403, 'حذف الرواتب متاح للمدير فقط');
    }

    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendError(res, 400, 'معرف الراتب غير صالح');
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return sendError(res, 404, 'الراتب غير موجود');
    }

    if (payroll.status === PayrollStatus.PAID) {
      return sendError(res, 403, 'لا يمكن حذف راتب تم دفعه');
    }

    const previousValues = payroll.toObject();

    await payroll.deleteOne();

    // Create audit log
    if (AuditLog) {
      try {
        await AuditLog.create({
          user: req.user._id,
          action: 'DELETE',
          entity: 'Payroll',
          entityId: id,
          details: { employee: previousValues.employee.toString() },
          previousValues: previousValues.totals,
          newValues: null
        });
      } catch (logError) {
        console.error('Error creating audit log:', logError);
      }
    }

    res.json({
      success: true,
      message: 'تم حذف الراتب بنجاح'
    });
  } catch (error) {
    console.error('Error deleting payroll:', error);
    return sendError(res, 500, 'خطأ في حذف الراتب', error.message);
  }
};

/**
 * Get payroll summary/statistics
 * GET /api/payroll/summary
 */
const getPayrollSummary = async (req, res) => {
  try {
    const { month, year } = req.query;

    let query = {};
    if (month && year) {
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
        return sendError(res, 400, 'شهر أو سنة غير صالحة');
      }
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0);
      query.periodStart = { $gte: startDate };
      query.periodEnd = { $lte: endDate };
    }

    // Department filter for managers
    if (req.user.role === 'manager' && req.user.department) {
      const employees = await User.find({ department: req.user.department }).select('_id');
      const employeeIds = employees.map(e => e._id);
      if (employeeIds.length === 0) {
        // No employees in dept, return empty summary
        return res.json({
          success: true,
          data: {
            totalPayrolls: 0,
            statusBreakdown: { pending: 0, approved: 0, paid: 0, cancelled: 0 },
            totals: { gross: 0, deductions: 0, net: 0 },
            averageNet: 0
          }
        });
      }
      query.employee = { $in: employeeIds };
    }

    const payrolls = await Payroll.find(query).lean();

    // Defensive: ensure payrolls is an array
    const payrollList = Array.isArray(payrolls) ? payrolls : [];

    const summary = {
      totalPayrolls: payrollList.length,
      statusBreakdown: {
        pending: payrollList.filter(p => p.status === 'pending').length,
        approved: payrollList.filter(p => p.status === 'approved').length,
        paid: payrollList.filter(p => p.status === 'paid').length,
        cancelled: payrollList.filter(p => p.status === 'cancelled').length
      },
      totals: {
        gross: payrollList.reduce((sum, p) => {
          const gross = p.totals?.gross;
          return sum + (safeNumber(gross, 0));
        }, 0),
        deductions: payrollList.reduce((sum, p) => {
          const ded = p.totals?.deductions;
          return sum + (safeNumber(ded, 0));
        }, 0),
        net: payrollList.reduce((sum, p) => {
          const net = p.totals?.net;
          return sum + (safeNumber(net, 0));
        }, 0)
      },
      averageNet: payrollList.length > 0
        ? payrollList.reduce((sum, p) => sum + safeNumber(p.totals?.net, 0), 0) / payrollList.length
        : 0
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching payroll summary:', error);
    return sendError(res, 500, 'خطأ في جلب ملخص الرواتب', error.message);
}
};

/**
 * Get recent payments (for dashboard)
 * GET /api/payroll/recent
 */
const getRecentPayments = async (req, res) => {
  try {
    let query = {};

    // Department filter for managers
    if (req.user.role === 'manager' && req.user.department) {
      const employees = await User.find({ department: req.user.department }).select('_id');
      const employeeIds = employees.map(e => e._id);
      if (employeeIds.length === 0) {
        return res.json({ success: true, data: { recentPayments: [] } });
      }
      query.employee = { $in: employeeIds };
    }

    const recentPayrolls = await Payroll.find(query)
      .populate('employee', 'name department')
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(5)
      .lean();

    const validPayrolls = (recentPayrolls || []).filter(p => p && p.employee != null);

    const formatted = validPayrolls.map(p => ({
      id: p._id,
      employee: p.employee?.name || 'غير معروف',
      department: p.employee?.department || '',
      amount: p.totals?.net || 0,
      gross: p.totals?.gross || 0,
      date: p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : '',
      status: p.status || 'pending'
    }));

res.json({ success: true, data: { recentPayments: formatted } });
  } catch (error) {
    console.error('Error fetching recent payments:', error);
    return sendError(res, 500, 'خطأ في جلب المدفوعات الأخيرة', error.message);
  }
};

/**
 * Get current/active payslip for employee with full compensation breakdown
 * GET /api/payroll/payslip/current
 */
const getCurrentPayslip = async (req, res) => {
  try {
    const employeeId = req.user._id;
    const { period } = req.query;

    const query = { employee: employeeId };

    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [year, month] = period.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      query.periodStart = { '$gte': start };
      query.periodEnd = { '$lte': end };
      query.status = { '$in': ['pending', 'approved', 'paid'] };
    } else {
      query.status = { '$in': ['pending', 'approved'] };
    }

    const payroll = await Payroll.findOne(query)
      .sort({ periodEnd: -1 })
      .populate('employee', 'name username department email phone');

    if (!payroll) {
      return res.json({
        success: true,
        data: {
          payslip: null,
          message: 'لا توجد فترة رواتب مفتوحة حالياً',
        },
      });
    }

    // Fetch all active PayrollItems linked to this employee
    let PayrollItem;
    try { PayrollItem = require('../models/PayrollItem').PayrollItem; } catch (e) { PayrollItem = null; }

    let payrollItems = [];
    if (PayrollItem) {
      payrollItems = await PayrollItem.find({
        employee: employeeId,
        status: 'active',
        '$or': [
          { payrollPeriod: payroll._id },
          { payrollPeriod: null },
        ],
      }).lean();
    }

    // Group items by direction
    const additions = payrollItems.filter(i => i.direction === 'addition');
    const deductions = payrollItems.filter(i => i.direction === 'deduction');

    // Fetch approved leaves/missions for the period
    const missions = await (require('../models/Task').Task).find({
      assignedTo: employeeId,
      status: 'approved',
      isUnusual: true,
      taskDate: { '$gte': payroll.periodStart, '$lte': payroll.periodEnd },
    }).lean().catch(() => []);

    // Build payslip structure
    const payslipData = {
      payslipNumber: payroll.payslipNumber,
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      employeeInfo: {
        name: payroll.employee?.name || '',
        department: payroll.employee?.department || '',
        email: payroll.employee?.email || '',
      },
      income: {
        baseSalary: payroll.baseSalary || 0,
        allowances: payroll.components?.allowances || [],
        bonuses: payroll.components?.bonuses || [],
        overtime: {
          approved: payrollItems.filter(i => i.type === 'overtime'),
          totalOvertimeAmount: additions.filter(i => i.type === 'overtime').reduce((s, i) => s + i.amount, 0),
        },
        missions: {
          approved: missions,
          totalMissionAllowance: additions.filter(i => i.type === 'mission').reduce((s, i) => s + i.amount, 0),
        },
        additionsTotal: additions.reduce((s, i) => s + i.amount, 0),
      },
      deductions: {
        unpaidLeave: {
          items: deductions.filter(i => i.type === 'leave' && i.payrollCode === 'LEAVE_UNPAID_DEDUCTION'),
          total: deductions.filter(i => i.type === 'leave' && i.payrollCode === 'LEAVE_UNPAID_DEDUCTION').reduce((s, i) => s + i.amount, 0),
        },
        hourlyShortfall: {
          items: deductions.filter(i => i.payrollCode === 'LEAVE_HOURLY_PARTIAL_UNPAID' || i.payrollCode === 'LEAVE_HOURLY_DEDUCTION'),
          total: deductions.filter(i => i.payrollCode === 'LEAVE_HOURLY_PARTIAL_UNPAID' || i.payrollCode === 'LEAVE_HOURLY_DEDUCTION').reduce((s, i) => s + i.amount, 0),
        },
        hoursShortfall: {
          items: (payroll.deductions?.other || []).filter(d => d.type === 'fine'),
          total: (payroll.deductions?.other || []).filter(d => d.type === 'fine').reduce((s, d) => s + (d.amount || 0), 0),
        },
        otherDeductions: (payroll.deductions?.other || []).filter(d => d.type !== 'fine'),
        deductionsTotal: deductions.reduce((s, i) => s + i.amount, 0) + (payroll.totals?.deductions || 0),
      },
      totals: {
        gross: (payroll.baseSalary || 0) + additions.reduce((s, i) => s + i.amount, 0) + (payroll.totals?.gross || 0),
        deductions: deductions.reduce((s, i) => s + i.amount, 0) + (payroll.totals?.deductions || 0),
        net: (payroll.baseSalary || 0) + additions.reduce((s, i) => s + i.amount, 0) - deductions.reduce((s, i) => s + i.amount, 0) + (payroll.totals?.net || 0),
      },
      leaveBalances: await (require('../models/LeaveRequest').LeaveRequest).checkLeaveBalance(employeeId, 'annual').catch(() => ({})),
      sickLeaveBalance: await (require('../models/LeaveRequest').LeaveRequest).checkLeaveBalance(employeeId, 'sick').catch(() => ({})),
      status: payroll.status,
      isDraft: payroll.status === 'pending',
    };

    res.json({ success: true, data: { payslip: payslipData } });
  } catch (error) {
    console.error('Error fetching current payslip:', error);
    return res.status(500).json({ success: false, message: 'خطأ في جلب كشف الراتب', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

/**
 * Export payslip PDF data with digital signature markers
 * GET /api/payroll/:id/payslip/export
 */
const exportPayslipPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const payroll = await Payroll.findById(id).populate('employee', 'name username department email phone');
    if (!payroll) return res.status(404).json({ success: false, message: 'الراتب غير موجود' });

    const items = await (require('../models/PayrollItem').PayrollItem || Promise.resolve([])).find({ employee: payroll.employee, status: 'active' }).lean().catch(() => []);

    const exportData = {
      exportTimestamp: new Date().toISOString(),
      digitalSignature: crypto.createHash('sha256').update(JSON.stringify(payroll.totals) + payroll._id).digest('hex'),
      payslipNumber: payroll.payslipNumber,
      companyName: 'شركة إدارة الموارد البشرية',
      employeeName: payroll.employee?.name || '',
      period: payroll.periodStart?.toLocaleDateString('ar-EG') + ' - ' + payroll.periodEnd?.toLocaleDateString('ar-EG'),
      baseSalary: payroll.baseSalary,
      allowances: payroll.components?.allowances || [],
      bonuses: payroll.components?.bonuses || [],
      overtime: payroll.components?.overtime || {},
      additions: items.filter(i => i.direction === 'addition'),
      deductions: items.filter(i => i.direction === 'deduction'),
      totals: payroll.totals,
      netWords: numberToArabicWords(payroll.totals?.net || 0),
    };
    res.json({ success: true, data: { export: exportData } });
  } catch (error) {
    console.error('Error exporting payslip:', error);
    res.status(500).json({ success: false, message: 'خطأ في تصدير الكشف' });
  }
};

function numberToArabicWords(num) {
  if (num === 0) return 'صفر';
  return num + ' ريال سعودي فقط لا غير';
}

module.exports = {
  getPayrollByEmployee, getAllPayrolls, generatePayroll, updatePayroll,
  approvePayroll, markAsPaid, deletePayroll, getPayrollSummary,
  generatePayslip, getPendingPayrollAssignments, assignSalaryToPendingPayroll,
  getRecentPayments, getCurrentPayslip, exportPayslipPDF,
};