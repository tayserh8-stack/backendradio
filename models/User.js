/**
 * User Model
 * Represents employees, managers, and admin users
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define user roles enum
const UserRole = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  HR: 'hr',
  ADMIN: 'admin'
};

// Define departments
const Department = {
  FINANCIAL: 'financial',
  IT: 'it',
  MARKETING: 'marketing',
  NEWS: 'news',
  PRODUCTION: 'production',
  LIVE_BROADCAST: 'live_broadcast',
  HR: 'hr'
};

// User Schema
const userSchema = new mongoose.Schema({
  // Email - unique identifier
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  
  // Username - unique identifier
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Password (hashed)
  password: {
    type: String,
    required: true
  },
  
  // Full name in Arabic
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // User role: employee, manager, or admin
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.EMPLOYEE
  },
  
  // Department (for employees and managers)
  department: {
    type: String,
    default: null
  },

  // Salary fields (managed via comprehensive payroll page)
  baseSalary: { type: Number, default: 0 },
  housingAllowance: { type: Number, default: 0 },
  transportAllowance: { type: Number, default: 0 },
  otherAllowances: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  overtime: { type: Number, default: 0 },
  socialInsurance: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  otherDeductions: { type: Number, default: 0 },
  hoursShortfall: { type: Number, default: 0 },
  
  // Profile image URL
  profileImage: {
    type: String,
    default: null
  },
  
  // Phone number
  phone: {
    type: String,
    default: null
  },
  
  // Employment start date
  startDate: {
    type: Date,
    default: Date.now
  },
  
  // Performance score (calculated)
  performanceScore: {
    type: Number,
    default: 0
  },
  
  // Is account active
  isActive: {
    type: Boolean,
    default: false
  },
  
  // Last login timestamp
  lastLogin: {
    type: Date,
    default: null
  },

  // Employee Profile - Detailed information
  jobTitle: {
    type: String,
    default: ''
  },
  nationalId: {
    type: String,
    default: ''
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  placeOfBirth: {
    type: String,
    default: ''
  },
  nationality: {
    type: String,
    default: ''
  },
  gender: {
    type: String,
    enum: ['male', 'female', ''],
    default: ''
  },
  maritalStatus: {
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed', ''],
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  emergencyContactName: {
    type: String,
    default: ''
  },
  emergencyContactPhone: {
    type: String,
    default: ''
  },
  emergencyContactRelation: {
    type: String,
    default: ''
  },
  education: {
    type: String,
    default: ''
  },
  specialization: {
    type: String,
    default: ''
  },
  yearsOfExperience: {
    type: Number,
    default: 0
  },
  previousEmployer: {
    type: String,
    default: ''
  },
  bankAccountNumber: {
    type: String,
    default: ''
  },
  bankName: {
    type: String,
    default: ''
  },
  taxNumber: {
    type: String,
    default: ''
  },
  socialSecurityNumber: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },

  // CV / Resume file
  cvUrl: {
    type: String,
    default: null
  },
  cvFileName: {
    type: String,
    default: null
  },
  cvUploadedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Generate salt and hash
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get public profile (without password)
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    name: this.name,
    role: this.role,
    department: this.department,
    baseSalary: this.baseSalary,
    housingAllowance: this.housingAllowance,
    transportAllowance: this.transportAllowance,
    otherAllowances: this.otherAllowances,
    bonus: this.bonus,
    overtime: this.overtime,
    socialInsurance: this.socialInsurance,
    tax: this.tax,
    otherDeductions: this.otherDeductions,
    hoursShortfall: this.hoursShortfall,
    profileImage: this.profileImage,
    phone: this.phone,
    startDate: this.startDate,
    performanceScore: this.performanceScore,
    isActive: this.isActive,
    createdAt: this.createdAt,
    jobTitle: this.jobTitle,
    nationalId: this.nationalId,
    dateOfBirth: this.dateOfBirth,
    placeOfBirth: this.placeOfBirth,
    nationality: this.nationality,
    gender: this.gender,
    maritalStatus: this.maritalStatus,
    address: this.address,
    emergencyContactName: this.emergencyContactName,
    emergencyContactPhone: this.emergencyContactPhone,
    emergencyContactRelation: this.emergencyContactRelation,
    education: this.education,
    specialization: this.specialization,
    yearsOfExperience: this.yearsOfExperience,
    previousEmployer: this.previousEmployer,
    bankAccountNumber: this.bankAccountNumber,
    bankName: this.bankName,
    taxNumber: this.taxNumber,
    socialSecurityNumber: this.socialSecurityNumber,
    notes: this.notes,
    cvUrl: this.cvUrl,
    cvFileName: this.cvFileName,
    cvUploadedAt: this.cvUploadedAt
  };
};

// Static method to create admin account
userSchema.statics.createAdmin = async function() {
  const adminExists = await this.findOne({ role: 'admin' });
  
  if (!adminExists) {
    await this.create({
      email: 'admin@example.com',
      username: 'admin',
      password: 'admin',
      name: 'المدير العام',
      role: 'admin',
      department: null,
      isActive: true
    });
    console.log('✅ تم إنشاء حساب المدير العام الافتراضي');
  }
};

const User = mongoose.model('User', userSchema);

module.exports = { User, UserRole, Department };