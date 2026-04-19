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
  ADMIN: 'admin'
};

// Define departments
const Department = {
  PRODUCTION: 'production',
  NEWS: 'news',
  MARKETING: 'marketing'
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
    enum: Object.values(Department),
    default: null
  },
  
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
    profileImage: this.profileImage,
    phone: this.phone,
    startDate: this.startDate,
    performanceScore: this.performanceScore,
    isActive: this.isActive,
    createdAt: this.createdAt
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