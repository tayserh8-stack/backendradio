/**
 * Compensation Service
 * Core financial calculation engine for leave, mission, overtime, and attendance corrections.
 */
const { LeaveRequest } = require('../models/LeaveRequest');
const { PayrollItem, PayrollItemType, PayrollItemDirection } = require('../models/PayrollItem');
const { User } = require('../models/User');
const { Task } = require('../models/Task');

const safeNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

const WORKING_DAYS_PER_MONTH = 22;
const HOURS_PER_DAY = 8;
const HOURS_PER_MONTH = WORKING_DAYS_PER_MONTH * HOURS_PER_DAY;

const calculateDailyRate = (monthlySalary) => safeNumber(monthlySalary) / WORKING_DAYS_PER_MONTH;
const calculateHourlyRate = (monthlySalary) => safeNumber(monthlySalary) / HOURS_PER_MONTH;

const getOvertimeMultiplier = (date) => {
  if (!date) return 1.5;
  const day = new Date(date).getDay();
  if (day === 5 || day === 6) return 2.0;
  return 1.5;
};

const calculateCompensation = async (options) => {
  const { employeeId, requestType, days = 0, hours = 0, executionDate = new Date(), employeePolicy = {}, missionCount = 0, fixedAllowance = 0, overtimeRate: customOvertimeRate } = options;

  const employee = await User.findById(employeeId).lean();
  if (!employee) throw new Error('Employee not found');

  const monthlySalary = safeNumber(employeePolicy.monthlySalary || employee.baseSalary || 0);
  const dailyRate = calculateDailyRate(monthlySalary);
  const hourlyRate = calculateHourlyRate(monthlySalary);
  const currency = employeePolicy.currency || 'SAR';

  let amount = 0, isDeduction = false, payrollCode = '', breakdown = {};

  switch (requestType) {
    case 'annual': case 'sick': case 'maternity': case 'paternity': case 'emergency': case 'exceptional': case 'death': case 'compensatory':
      amount = 0; isDeduction = false; payrollCode = 'LEAVE_FULLY_PAID';
      breakdown = { base: 0, days, dailyRate, note: 'Fully paid - no financial impact' };
      break;
    case 'unpaid':
      amount = dailyRate * days; isDeduction = true; payrollCode = 'LEAVE_UNPAID_DEDUCTION';
      breakdown = { days, dailyRate, calculation: dailyRate + ' x ' + days + ' = ' + amount, note: 'Unpaid leave deduction for ' + days + ' day(s)' };
      break;
    case 'hourly': {
      const balance = await LeaveRequest.checkLeaveBalance(employeeId, 'annual');
      const remainingHours = balance.remainingHours || (balance.remainingBalance * HOURS_PER_DAY);
      let unpaidHours = 0, annualHours = 0;
      if (hours > remainingHours) { annualHours = remainingHours; unpaidHours = hours - remainingHours; payrollCode = 'LEAVE_HOURLY_PARTIAL_UNPAID'; }
      else { annualHours = hours; payrollCode = 'LEAVE_HOURLY_DEDUCTION'; }
      amount = unpaidHours * hourlyRate; isDeduction = amount > 0;
      breakdown = { totalHours: hours, annualLeaveHours: annualHours, unpaidHours, hourlyRate, unpaidDeduction: amount, remainingAnnualLeaveHours: Math.max(0, remainingHours - annualHours) };
      break;
    }
    case 'mission': {
      const isExternal = options.missionType === 'external';
      const perMission = isExternal ? safeNumber(fixedAllowance) || 200 : safeNumber(fixedAllowance) || 100;
      amount = perMission * Math.max(1, missionCount || 1); isDeduction = false;
      payrollCode = isExternal ? 'MISSION_EXTERNAL_ALLOWANCE' : 'MISSION_INTERNAL_ALLOWANCE';
      breakdown = { missionType: isExternal ? 'external' : 'internal', missionCount: Math.max(1, missionCount), perMissionAllowance: perMission, calculation: perMission + ' x ' + Math.max(1, missionCount) + ' = ' + amount };
      break;
    }
    case 'overtime': {
      const multiplier = customOvertimeRate || getOvertimeMultiplier(executionDate);
      amount = hourlyRate * multiplier * hours; isDeduction = false; payrollCode = 'OVERTIME_PAYMENT';
      breakdown = { hours, hourlyRate, multiplier, calculation: hourlyRate + ' x ' + multiplier + ' x ' + hours + ' = ' + amount, isHoliday: multiplier >= 2.0 };
      break;
    }
    case 'attendance_correction':
      amount = 0; isDeduction = false; payrollCode = 'ATTENDANCE_CORRECTION';
      breakdown = { note: 'Attendance correction - indirect impact on absence calculation' };
      break;
    default: throw new Error('Unknown request type: ' + requestType);
  }

  return { amount: Math.round(amount * 100) / 100, currency, payrollCode, isDeduction, breakdown };
};

const checkFinancialOverlap = async (employeeId, startDate, endDate, excludeId = null, options = {}) => {
  const start = new Date(startDate), end = new Date(endDate);
  const conflicts = [];

  // Status filter: exclude draft/cancelled/rejected
  const activeStatuses = { '$in': ['pending_manager', 'pending_general_manager', 'approved', 'synced_to_payroll'] };

  // 1) Check overlapping leave requests (all types)
  const leaveQuery = { employee: employeeId, status: activeStatuses };
  leaveQuery['$or'] = [{ startDate: { '$lte': end }, endDate: { '$gte': start } }];
  if (options.requestType === 'overtime') {
    // For overtime, only flag non-overtime leaves as conflicts
    leaveQuery.type = { '$ne': 'overtime' };
  }
  if (excludeId) leaveQuery._id = { '$ne': excludeId };

  const overlappingLeaves = await LeaveRequest.find(leaveQuery).lean();
  for (const l of overlappingLeaves) {
    conflicts.push({ type: 'leave', id: l._id.toString(), subtype: l.type, reason: l.type === 'overtime' ? 'أجر إضافي موجود مسبقاً' : 'إجازة (' + l.type + ') تتعارض مع الفترة المطلوبة' });
  }

  // 2) Check overlapping missions (Tasks with isUnusual flag)
  const missionQuery = {
    assignedTo: employeeId,
    status: { '$in': ['pending', 'in_progress', 'approved'] },
    isUnusual: true,
    '$or': [{ startTime: { '$lte': end }, endTime: { '$gte': start } }],
  };
  const overlappingMissions = await Task.find(missionQuery).lean();
  for (const m of overlappingMissions) {
    conflicts.push({ type: 'mission', id: m._id.toString(), reason: 'مهمة "' + (m.title || '') + '" تتعارض مع الفترة المطلوبة' });
  }

  // 3) Check for overtime on same day when requesting leave (vice versa)
  if (options.requestType === 'leave' || options.requestType === 'annual' || options.requestType === 'sick') {
    const overtimeOnDay = await LeaveRequest.find({
      employee: employeeId, type: 'overtime', status: activeStatuses,
      startDate: { '$gte': start, '$lte': end },
    }).lean();
    for (const o of overtimeOnDay) {
      conflicts.push({ type: 'overtime', id: o._id.toString(), reason: 'يوجد أجر إضافي مسجل في نفس اليوم' });
    }
  }

  return { hasOverlap: conflicts.length > 0, conflicts };
};

const SOURCE_MODEL_MAP = {
  mission: 'LeaveRequest', overtime: 'LeaveRequest', hourly: 'LeaveRequest',
  annual: 'LeaveRequest', sick: 'LeaveRequest', unpaid: 'LeaveRequest',
  maternity: 'LeaveRequest', paternity: 'LeaveRequest', emergency: 'LeaveRequest',
  compensatory: 'LeaveRequest', attendance_correction: 'LeaveRequest',
};

const syncCompensationToPayroll = async (compensation, sourceType, sourceId, employeeId, idempotencyKey, options = {}) => {
  const existing = await PayrollItem.findOne({ idempotencyKey });
  if (existing) return existing;

  const sourceModel = options.sourceModel || SOURCE_MODEL_MAP[sourceType] || 'LeaveRequest';

  // Atomic transaction: create PayrollItem + (optionally) update leave status
  const session = options.session || null;

  const item = new PayrollItem({
    employee: employeeId,
    type: sourceType === 'mission' ? 'mission' : sourceType === 'overtime' ? 'overtime' : sourceType === 'attendance_correction' ? 'attendance_correction' : 'leave',
    direction: compensation.isDeduction ? 'deduction' : 'addition',
    amount: compensation.amount,
    currency: compensation.currency,
    payrollCode: compensation.payrollCode,
    sourceType,
    sourceModel,
    sourceId,
    effectiveDate: options.effectiveDate || new Date(),
    idempotencyKey,
    status: 'active',
    description: options.description || '',
    metadata: compensation.breakdown,
    createdBy: options.createdBy || null,
  });

  await item.save({ session });
  return item;
};

module.exports = { calculateCompensation, calculateDailyRate, calculateHourlyRate, getOvertimeMultiplier, checkFinancialOverlap, syncCompensationToPayroll };