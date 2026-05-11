/**
 * Payroll/Payslip Model
 * Represents employee salary payments, deductions, bonuses, and overtime
 */

const mongoose = require('mongoose');

// Payroll status enum
const PayrollStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
  CANCELLED: 'cancelled'
};

// Payroll frequency enum
const PayrollFrequency = {
  MONTHLY: 'monthly',
  BIWEEKLY: 'biweekly',
  WEEKLY: 'weekly'
};

const payrollSchema = new mongoose.Schema({
  // Employee reference
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment period
  periodStart: {
    type: Date,
    required: true
  },
  
  periodEnd: {
    type: Date,
    required: true
  },
  
  // Payment date
  paymentDate: {
    type: Date,
    required: true
  },
  
  // Payroll frequency
  frequency: {
    type: String,
    enum: Object.values(PayrollFrequency),
    default: PayrollFrequency.MONTHLY
  },
  
   // Base salary (from employee profile)
   baseSalary: {
     type: Number,
     default: null
   },
  
  // Regular working days in period
  workingDays: {
    type: Number,
    default: 0
  },
  
  // Days worked
  daysWorked: {
    type: Number,
    default: 0
  },
  
  // Salary components
  components: {
    // Fixed allowances
    allowances: [{
      type: {
        type: String,
        enum: ['housing', 'transport', 'food', 'communication', 'other'],
        required: true
      },
      amount: {
        type: Number,
        required: true,
        default: 0
      },
      description: String
    }],
    
    // Bonuses
    bonuses: [{
      type: {
        type: String,
        enum: ['performance', 'attendance', 'project', 'holiday', 'other'],
        required: true
      },
      amount: {
        type: Number,
        required: true,
        default: 0
      },
      reason: String,
      referenceId: mongoose.Schema.Types.ObjectId
    }],
    
    // Overtime
    overtime: {
      hours: {
        type: Number,
        default: 0
      },
      hourlyRate: {
        type: Number,
        default: 0
      },
      totalAmount: {
        type: Number,
        default: 0
      }
    }
  },
  
  // Deductions
  deductions: {
    // Absent days deduction
    absences: {
      days: {
        type: Number,
        default: 0
      },
      dailyRate: {
        type: Number,
        default: 0
      },
      totalAmount: {
        type: Number,
        default: 0
      }
    },
    
    // Late penalties
    latePenalties: {
      occurrences: {
        type: Number,
        default: 0
      },
      amountPerOccurrence: {
        type: Number,
        default: 0
      },
      totalAmount: {
        type: Number,
        default: 0
      }
    },
    
    // Other deductions
    other: [{
      type: {
        type: String,
        enum: ['loan', 'advance', 'fine', 'tax', 'insurance', 'other'],
        required: true
      },
      amount: {
        type: Number,
        required: true,
        default: 0
      },
      description: String
    }]
  },
  
  // Summary amounts
  totals: {
    // Gross salary (base + allowances + bonuses + overtime)
    gross: {
      type: Number,
      default: 0
    },
    
    // Total deductions
    deductions: {
      type: Number,
      default: 0
    },
    
    // Net salary (gross - deductions)
    net: {
      type: Number,
      default: 0
    }
  },
  
  // Payroll status
  status: {
    type: String,
    enum: Object.values(PayrollStatus),
    default: PayrollStatus.PENDING
  },
  
  // Approval workflow
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  approvedAt: {
    type: Date,
    default: null
  },
  
  // Payment information
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'check'],
    default: 'bank_transfer'
  },
  
  // Notes
  notes: {
    type: String,
    default: ''
  },
  
  // Payslip generated
  payslipGenerated: {
    type: Boolean,
    default: false
  },
  
  // Audit trail
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
   // Recalculation flag
   needsRecalculation: {
     type: Boolean,
     default: false
   },

   // Flag to indicate payroll was auto-generated from employee registration
   isPendingSalaryAssignment: {
     type: Boolean,
     default: false
   }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
payrollSchema.index({ employee: 1, periodStart: -1, periodEnd: -1 });
payrollSchema.index({ status: 1 });
payrollSchema.index({ isPendingSalaryAssignment: 1 });
payrollSchema.index({ createdAt: -1 });

// Virtual for payslip number
payrollSchema.virtual('payslipNumber').get(function() {
  return `PAY-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Pre-save hook to calculate totals
payrollSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

// Calculate totals method
payrollSchema.methods.calculateTotals = function() {
  let gross = this.baseSalary || 0;
  
  // Add allowances
  if (this.components && this.components.allowances) {
    this.components.allowances.forEach(allowance => {
      gross += allowance.amount || 0;
    });
  }
  
  // Add bonuses
  if (this.components && this.components.bonuses) {
    this.components.bonuses.forEach(bonus => {
      gross += bonus.amount || 0;
    });
  }
  
  // Add overtime
  if (this.components && this.components.overtime) {
    const overtime = this.components.overtime;
    overtime.totalAmount = (overtime.hours || 0) * (overtime.hourlyRate || 0);
    gross += overtime.totalAmount;
  }
  
  // Calculate deductions
  let totalDeductions = 0;
  
  // Absences
  if (this.deductions && this.deductions.absences) {
    const absences = this.deductions.absences;
    absences.totalAmount = (absences.days || 0) * (absences.dailyRate || 0);
    totalDeductions += absences.totalAmount;
  }
  
  // Late penalties
  if (this.deductions && this.deductions.latePenalties) {
    const latePenalties = this.deductions.latePenalties;
    latePenalties.totalAmount = (latePenalties.occurrences || 0) * (latePenalties.amountPerOccurrence || 0);
    totalDeductions += latePenalties.totalAmount;
  }
  
  // Other deductions
  if (this.deductions && this.deductions.other) {
    this.deductions.other.forEach(deduction => {
      totalDeductions += deduction.amount || 0;
    });
  }
  
  this.totals.deductions = totalDeductions;
  this.totals.gross = gross;
  this.totals.net = gross - totalDeductions;
};

// Get public profile method
payrollSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    payslipNumber: this.payslipNumber,
    employee: this.employee,
    periodStart: this.periodStart,
    periodEnd: this.periodEnd,
    paymentDate: this.paymentDate,
    frequency: this.frequency,
    baseSalary: this.baseSalary,
    workingDays: this.workingDays,
    daysWorked: this.daysWorked,
    components: this.components,
    deductions: this.deductions,
    totals: this.totals,
    status: this.status,
    approvedBy: this.approvedBy,
    approvedAt: this.approvedAt,
    paymentMethod: this.paymentMethod,
    notes: this.notes,
    payslipGenerated: this.payslipGenerated,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const Payroll = mongoose.model('Payroll', payrollSchema);

module.exports = { Payroll, PayrollStatus, PayrollFrequency };