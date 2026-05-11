/**
 * PayrollItem Model
 * Individual financial line items linked to leave requests, missions, overtime, and corrections.
 * Each item represents a single addition or deduction tied to an approved request.
 */
const mongoose = require('mongoose');

const PayrollItemType = {
  LEAVE: 'leave',
  MISSION: 'mission',
  OVERTIME: 'overtime',
  ATTENDANCE_CORRECTION: 'attendance_correction',
  OTHER: 'other',
};

const PayrollItemDirection = {
  ADDITION: 'addition',
  DEDUCTION: 'deduction',
};

const payrollItemSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: Object.values(PayrollItemType), required: true },
  direction: { type: String, enum: Object.values(PayrollItemDirection), required: true },
  amount: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'SAR' },
  payrollCode: { type: String, required: true },

  // Polymorphic reference to source (LeaveRequest, Task, etc.)
  sourceType: { type: String, required: true },
  sourceModel: { type: String, required: true, default: 'LeaveRequest' },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'sourceModel' },

  // Payroll period linkage
  payrollPeriod: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll', default: null },
  effectiveDate: { type: Date, required: true },

  // Idempotency key to prevent duplicate processing
  idempotencyKey: { type: String, unique: true, required: true },

  // Status
  status: { type: String, enum: ['pending', 'active', 'processed', 'cancelled'], default: 'active' },

  // Human-readable description (Arabic)
  description: { type: String, default: '' },

  // Metadata / breakdown from compensation calculation
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Audit trail
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  processedAt: { type: Date, default: null },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

payrollItemSchema.index({ employee: 1, payrollPeriod: 1 });
payrollItemSchema.index({ sourceType: 1, sourceId: 1 });
payrollItemSchema.index({ status: 1, effectiveDate: -1 });

const PayrollItem = mongoose.model('PayrollItem', payrollItemSchema);

module.exports = { PayrollItem, PayrollItemType, PayrollItemDirection };