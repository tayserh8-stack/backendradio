/**
 * Audit Log Model
 * Tracks all critical changes in the system for security auditing
 */

const mongoose = require('mongoose');

// Audit action types
const AuditAction = {
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  PAY: 'PAY',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT'
};

const auditLogSchema = new mongoose.Schema({
  // User who performed the action
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // User role at time of action
  userRole: {
    type: String,
    required: true
  },
  
  // User department (if applicable)
  userDepartment: String,
  
  // Action type
  action: {
    type: String,
    enum: Object.values(AuditAction),
    required: true
  },
  
  // Entity affected
  entity: {
    type: String,
    required: true
  },
  
  // Entity ID
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Action details
  details: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Previous values (for UPDATE/DELETE)
  previousValues: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // New values (for CREATE/UPDATE)
  newValues: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // IP address
  ipAddress: {
    type: String,
    default: null
  },
  
  // User agent
  userAgent: {
    type: String,
    default: null
  },
  
  // Session ID
  sessionId: {
    type: String,
    default: null
  },
  
  // Risk level
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  
  // Notes
  notes: {
    type: String,
    default: ''
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// Calculate risk level based on action and entity
auditLogSchema.methods.calculateRiskLevel = function() {
  const highRiskActions = ['DELETE', 'UPDATE', 'APPROVE', 'PAY'];
  const highRiskEntities = ['Payroll', 'User', 'Department', 'Settings'];
  
  if (highRiskActions.includes(this.action) && 
      highRiskEntities.includes(this.entity)) {
    if (this.action === 'DELETE' || this.entity === 'Payroll') {
      return 'critical';
    }
    return 'high';
  }
  
  if (this.action === 'LOGIN' || this.action === 'LOGOUT') {
    return 'low';
  }
  
  return 'medium';
};

// Pre-save hook to set risk level
auditLogSchema.pre('save', function(next) {
  if (!this.riskLevel) {
    this.riskLevel = this.calculateRiskLevel();
  }
  next();
});

// Static method to create audit log
auditLogSchema.statics.logAction = async function(options) {
  const {
    user,
    userRole,
    userDepartment,
    action,
    entity,
    entityId,
    details = {},
    previousValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null,
    sessionId = null,
    notes = ''
  } = options;

  return await this.create({
    user,
    userRole,
    userDepartment,
    action,
    entity,
    entityId,
    details,
    previousValues,
    newValues,
    ipAddress,
    userAgent,
    sessionId,
    notes
  });
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = { AuditLog, AuditAction };
