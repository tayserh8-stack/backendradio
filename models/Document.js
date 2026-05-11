/**
 * Document Model
 * Manages document uploads, categorization, and version control
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Document categories
const DocumentCategory = {
  IDENTITY: 'identity',
  CONTRACT: 'contract',
  CERTIFICATE: 'certificate',
  POLICY: 'policy',
  TRAINING: 'training',
  PERFORMANCE: 'performance',
  LEAVE: 'leave',
  PAYROLL: 'payroll',
  OTHER: 'other'
};

// Document types
const DocumentType = {
  PDF: 'application/pdf',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPT: 'application/vnd.ms-powerpoint',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  JPG: 'image/jpeg',
  PNG: 'image/png',
  TXT: 'text/plain'
};

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', 
  '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.txt'
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const documentSchema = new mongoose.Schema({
  // Unique document identifier
  documentId: {
    type: String,
    default: uuidv4,
    unique: true,
    required: true
  },
  
  // Document metadata
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  category: {
    type: String,
    enum: Object.values(DocumentCategory),
    required: true
  },
  
  fileName: {
    type: String,
    required: true
  },
  
  fileUrl: {
    type: String,
    required: true
  },
  
  fileSize: {
    type: Number,
    required: true
  },
  
  mimeType: {
    type: String,
    required: true,
    enum: Object.values(DocumentType)
  },
  
  // Version control
  version: {
    type: Number,
    default: 1,
    required: true
  },
  
  isLatestVersion: {
    type: Boolean,
    default: true,
    required: true
  },
  
  // Parent document for version tracking
  parentDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    default: null
  },
  
  // Ownership and access
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Access control
  isPublic: {
    type: Boolean,
    default: false
  },
  
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  allowedRoles: [{
    type: String,
    enum: Object.values(require('./User').UserRole)
  }],
  
  allowedDepartments: [{
    type: String,
    enum: Object.values(require('./User').Department)
  }],
  
  // Security and validation
  virusScanStatus: {
    type: String,
    enum: ['clean', 'infected', 'pending', 'failed'],
    default: 'pending'
  },
  
  virusScanDate: {
    type: Date,
    default: null
  },
  
  // Metadata
  tags: [{
    type: String,
    trim: true
  }],
  
  // Expiration and retention
  expiryDate: {
    type: Date,
    default: null
  },
  
  retentionPolicy: {
    type: String,
    enum: ['none', '1_year', '3_years', '7_years', 'permanent'],
    default: 'none'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
documentSchema.index({ owner: 1, createdAt: -1 });
documentSchema.index({ category: 1, createdAt: -1 });
documentSchema.index({ isLatestVersion: 1, owner: 1 });
documentSchema.index({ parentDocument: 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ expiryDate: 1 });

// Virtual for file extension
documentSchema.virtual('fileExtension').get(function() {
  return this.fileName.split('.').pop().toLowerCase();
});

// Method to check if user can access document
documentSchema.methods.canAccess = function(user) {
  // Public documents are accessible to everyone
  if (this.isPublic) return true;
  
  // Owner always has access
  if (this.owner.equals(user._id)) return true;
  
  // Check allowed users
  if (this.allowedUsers.some(id => id.equals(user._id))) return true;
  
  // Check allowed roles
  if (this.allowedRoles.length > 0 && this.allowedRoles.includes(user.role)) return true;
  
  // Check allowed departments
  if (this.allowedDepartments.length > 0 && 
      this.allowedDepartments.includes(user.department)) return true;
  
  return false;
};

// Method to create a new version
documentSchema.methods.createNewVersion = async function(newFileData) {
  // Mark current version as not latest
  this.isLatestVersion = false;
  await this.save();
  
  // Create new version
  const newVersion = new Document({
    ...newFileData,
    owner: this.owner,
    uploadedBy: this.uploadedBy,
    version: this.version + 1,
    isLatestVersion: true,
    parentDocument: this._id,
    category: this.category,
    tags: this.tags,
    isPublic: this.isPublic,
    allowedUsers: this.allowedUsers,
    allowedRoles: this.allowedRoles,
    allowedDepartments: this.allowedDepartments,
    retentionPolicy: this.retentionPolicy
  });
  
  return await newVersion.save();
};

// Pre-save hook to validate file
documentSchema.pre('save', function(next) {
  // Validate file size
  if (this.fileSize > MAX_FILE_SIZE) {
    return next(new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`));
  }
  
  // Validate file extension
  const extension = `.${this.fileName.split('.').pop().toLowerCase()}`;
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return next(new Error(`File extension ${extension} is not allowed`));
  }
  
  next();
});

// Static method to upload document
documentSchema.statics.uploadDocument = async function(options) {
  const {
    title,
    description,
    category,
    fileName,
    fileUrl,
    fileSize,
    mimeType,
    owner,
    uploadedBy,
    tags = [],
    isPublic = false,
    allowedUsers = [],
    allowedRoles = [],
    allowedDepartments = [],
    expiryDate = null,
    retentionPolicy = 'none'
  } = options;
  
  // Check if document with same title exists for owner to handle versioning
  const existingDocument = await this.findOne({
    title,
    owner,
    isLatestVersion: true
  });
  
  let version = 1;
  let parentDocument = null;
  
  if (existingDocument) {
    version = existingDocument.version + 1;
    parentDocument = existingDocument._id;
    
    // Mark existing version as not latest
    await this.findByIdAndUpdate(existingDocument._id, { isLatestVersion: false });
  }
  
  const document = await this.create({
    title,
    description,
    category,
    fileName,
    fileUrl,
    fileSize,
    mimeType,
    owner,
    uploadedBy,
    version,
    isLatestVersion: true,
    parentDocument,
    tags,
    isPublic,
    allowedUsers,
    allowedRoles,
    allowedDepartments,
    expiryDate,
    retentionPolicy
  });
  
  return document;
};

const Document = mongoose.model('Document', documentSchema);

module.exports = { Document, DocumentCategory, DocumentType, ALLOWED_EXTENSIONS, MAX_FILE_SIZE };