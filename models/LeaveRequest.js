/**
 * Leave Request Model
 * Employee leave management system
 * Extended: hourly (sاعية), mission (مهمة), overtime (أجر إضافي), attendance correction (تصحيح بصمة)
 */

const mongoose = require('mongoose');

const LeaveType = {
  ANNUAL: 'annual',
  SICK: 'sick',
  EMERGENCY: 'emergency',
  EXCEPTIONAL: 'exceptional',
  DEATH: 'death',
  UNPAID: 'unpaid',
  MATERNITY: 'maternity',
  PATERNITY: 'paternity',
  COMPENSATORY: 'compensatory',
  HOURLY: 'hourly',
  MISSION: 'mission',
  OVERTIME: 'overtime',
  ATTENDANCE_CORRECTION: 'attendance_correction',
};

const LeaveStatus = {
  DRAFT: 'draft',
  PENDING_MANAGER: 'pending_manager',
  PENDING_GENERAL_MANAGER: 'pending_general_manager',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  SYNCED_TO_PAYROLL: 'synced_to_payroll',
};

const leaveRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: Object.values(LeaveType), required: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  startTime: { type: String, default: null },
  endTime: { type: String, default: null },
  days: { type: Number, default: 0 },
  hours: { type: Number, default: 0 },
  isHalfDay: { type: Boolean, default: false },
  reason: { type: String, required: true },
  documents: [{ url: String, description: String }],
  status: { type: String, enum: Object.values(LeaveStatus), default: LeaveStatus.DRAFT },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  department: { type: String, default: null },
  managerNotes: { type: String, default: null },
  coveragePlan: { type: String, default: null },
  managerSuggestedDays: { type: Number, default: null },
  idempotencyKey: { type: String, unique: true, sparse: true, default: null },

  // Mission-specific fields
  missionType: { type: String, enum: ['internal', 'external', null], default: null },
  visitParty: { type: String, default: null },
  geoLocation: {
    lat: Number,
    lng: Number,
    address: String,
  },
  transportAllowance: { type: Number, default: null },

  // Overtime-specific
  overtimeHours: { type: Number, default: null },
  overtimeHourlyRate: { type: Number, default: null },
  overtimeMultiplier: { type: Number, default: null },
  estimatedAmount: { type: Number, default: null },

  // Payroll sync
  payrollItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollItem', default: null },
  compensationResult: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

leaveRequestSchema.index({ employee: 1, startDate: -1 });
leaveRequestSchema.index({ department: 1, status: 1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });
// idempotencyKey has unique:true in field definition; no duplicate index needed

leaveRequestSchema.virtual('isActive').get(function () {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(this.startDate); start.setHours(0, 0, 0, 0);
  const end = new Date(this.endDate); end.setHours(23, 59, 59, 999);
  return this.status === LeaveStatus.APPROVED && today >= start && today <= end;
});

leaveRequestSchema.methods.calculateDays = function () {
  if (!this.startDate || !this.endDate) return 0;
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(end - start);
  let totalDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (this.isHalfDay) totalDays -= 0.5;
  this.days = Math.max(0, totalDays);
  return this.days;
};

leaveRequestSchema.methods.calculateHours = function () {
  if (this.startTime && this.endTime) {
    const [sh, sm] = this.startTime.split(':').map(Number);
    const [eh, em] = this.endTime.split(':').map(Number);
    this.hours = Math.max(0, (eh + em / 60) - (sh + sm / 60));
  }
  return this.hours;
};

leaveRequestSchema.statics.checkLeaveBalance = async function (employeeId, leaveType) {
  const currentYear = new Date().getFullYear();

  // Hourly leave deducts from annual balance
  const effectiveType = leaveType === 'hourly' ? 'annual' : leaveType;

  const approvedLeaves = await this.find({
    employee: employeeId,
    type: effectiveType,
    status: { '$in': [LeaveStatus.APPROVED, LeaveStatus.SYNCED_TO_PAYROLL] },
    startDate: { '$gte': new Date(currentYear, 0, 1) },
  });
  const usedDays = approvedLeaves.reduce((sum, l) => sum + (l.days || 0), 0);
  const usedHours = approvedLeaves.reduce((sum, l) => sum + (l.hours || 0), 0);
  const defaultBalances = {
    annual: 30, sick: 15, emergency: 5, exceptional: 10, death: 7, maternity: 90, paternity: 15,
    compensatory: 0, unpaid: Infinity, hourly: 30, mission: Infinity, overtime: Infinity, attendance_correction: Infinity,
  };
  const totalBalance = defaultBalances[effectiveType] || 0;
  const remainingBalance = totalBalance - usedDays;
  const remainingHours = (totalBalance * 8) - usedHours;
  const hasSufficientBalance = leaveType === 'hourly' ? remainingHours > 0 : remainingBalance > 0;
  return { totalBalance, usedDays, usedHours, remainingBalance, remainingHours, hasSufficientBalance };
};

leaveRequestSchema.statics.getOverlappingLeaves = async function (employeeId, startDate, endDate, excludeId = null) {
  const query = {
    employee: employeeId,
    status: { '$in': [LeaveStatus.APPROVED, LeaveStatus.PENDING_MANAGER, LeaveStatus.PENDING_GENERAL_MANAGER, LeaveStatus.SYNCED_TO_PAYROLL] },
    '$or': [{ startDate: { '$lte': endDate }, endDate: { '$gte': startDate } }],
  };
  if (excludeId) query._id = { '$ne': excludeId };
  return this.find(query);
};

leaveRequestSchema.statics.getDepartmentLeaveCalendar = async function (department, startDate, endDate) {
  return this.find({
    department,
    status: { '$in': [LeaveStatus.APPROVED, LeaveStatus.SYNCED_TO_PAYROLL] },
    '$or': [{ startDate: { '$lte': endDate }, endDate: { '$gte': startDate } }],
  }).populate('employee', 'name');
};

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
module.exports = { LeaveRequest, LeaveType, LeaveStatus };