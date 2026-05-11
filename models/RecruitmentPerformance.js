/**
 * Recruitment & Performance Management Models
 * Job Postings, Candidates, Performance Reviews, KPIs
 */

const mongoose = require('mongoose');

// Job Posting Status
const JobStatus = {
  DRAFT: 'draft',
  OPEN: 'open',
  CLOSED: 'closed',
  FILLED: 'filled'
};

// Job Posting Schema
const jobPostingSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  
  // Job Details
  jobType: {
    type: String,
    enum: ['full_time', 'part_time', 'contract', 'temporary', 'internship'],
    default: 'full_time'
  },
  
  level: {
    type: String,
    enum: ['entry', 'mid', 'senior', 'executive', 'manager'],
    default: 'entry'
  },
  
  // Description
  description: {
    type: String,
    required: true
  },
  
  requirements: {
    type: String,
    required: true
  },
  
  responsibilities: {
    type: String,
    required: true
  },
  
  preferredQualifications: {
    type: String,
    default: ''
  },
  
  // Location
  location: {
    type: String,
    default: 'Office'
  },
  
  isRemote: {
    type: Boolean,
    default: false
  },
  
  // Salary Range
  salaryRange: {
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'EGP'
    }
  },
  
  // Benefits
  benefits: [{
    type: String
  }],
  
  // Hiring Manager
  hiringManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: Object.values(JobStatus),
    default: JobStatus.DRAFT
  },
  
  // Application settings
  maxApplicants: {
    type: Number,
    default: 0 // 0 = unlimited
  },
  
  closeDate: {
    type: Date,
    default: null
  },
  
  // Interview stages
  interviewStages: [{
    stage: {
      type: String,
      enum: ['screening', 'phone', 'technical', 'hr', 'final', 'offer']
    },
    order: {
      type: Number,
      default: 0
    },
    required: {
      type: Boolean,
      default: true
    }
  }],
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Metadata
  views: {
    type: Number,
    default: 0
  },
  
  applications: {
    type: Number,
    default: 0
  },
  
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
jobPostingSchema.index({ department: 1, status: 1 });
jobPostingSchema.index({ status: 1, createdAt: -1 });
jobPostingSchema.index({ title: 'text', description: 'text' });

// Virtual for days open
jobPostingSchema.virtual('daysOpen').get(function() {
  if (!this.createdAt) return 0;
  const now = new Date();
  const diff = now - this.createdAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Virtual for fill rate
jobPostingSchema.virtual('isFilled').get(function() {
  return this.status === JobStatus.FILLED;
});

const JobPosting = mongoose.model('JobPosting', jobPostingSchema);

// Candidate Application Schema
const ApplicationStatus = {
  APPLIED: 'applied',
  SCREENING: 'screening',
  INTERVIEW: 'interview',
  OFFER: 'offer',
  HIRED: 'hired',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn'
};

const candidateApplicationSchema = new mongoose.Schema({
  // Job Reference
  jobPosting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true
  },
  
  // Applicant Information
  applicantName: {
    type: String,
    required: true,
    trim: true
  },
  
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  
  phone: {
    type: String,
    default: ''
  },
  
  // CV/Resume
  cvUrl: {
    type: String,
    default: null
  },
  
  // Cover Letter
  coverLetter: {
    type: String,
    default: ''
  },
  
  // Current/Previous Experience
  experience: {
    years: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      default: ''
    }
  },
  
  // Education
  education: {
    degree: {
      type: String,
      default: ''
    },
    institution: {
      type: String,
      default: ''
    },
    field: {
      type: String,
      default: ''
    },
    graduationYear: {
      type: Number,
      default: null
    }
  },
  
  // Skills
  skills: [{
    type: String
  }],
  
  // Current Status
  status: {
    type: String,
    enum: Object.values(ApplicationStatus),
    default: ApplicationStatus.APPLIED
  },
  
  // Interview Progress
  currentStage: {
    type: String,
    enum: ['screening', 'phone', 'technical', 'hr', 'final', 'offer', 'completed']
  },
  
  // Assessment Scores
  assessmentScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Interview Feedback
  interviewNotes: [{
    stage: String,
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    date: {
      type: Date,
      default: Date.now
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    recommendation: {
      type: String,
      enum: ['hire', 'reject', 'hold', 'more_info']
    }
  }],
  
  // Status History
  statusHistory: [{
    status: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  
  // Offer Details (if hired)
  offerDetails: {
    salary: Number,
    startDate: Date,
    accepted: Boolean,
    acceptedAt: Date
  },
  
  // Source
  source: {
    type: String,
    enum: ['website', 'referral', 'job_board', 'linkedin', 'other'],
    default: 'website'
  },
  
  // Rating
  overallRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 0
  },
  
  // Rejection reason
  rejectionReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
candidateApplicationSchema.index({ jobPosting: 1, status: 1 });
candidateApplicationSchema.index({ email: 1, jobPosting: 1 }, { unique: true });
candidateApplicationSchema.index({ status: 1, createdAt: -1 });

// Virtual for days in current stage
candidateApplicationSchema.virtual('daysInStage').get(function() {
  if (!this.updatedAt) return 0;
  const now = new Date();
  const diff = now - this.updatedAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

const CandidateApplication = mongoose.model('CandidateApplication', candidateApplicationSchema);

// Performance Review Schema
const ReviewStatus = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  APPROVED: 'approved'
};

const performanceReviewSchema = new mongoose.Schema({
  // Review Period
  reviewPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    period: {
      type: String,
      enum: ['Q1', 'Q2', 'Q3', 'Q4', 'Annual'],
      required: true
    },
    year: {
      type: Number,
      required: true
    }
  },
  
  // Employee
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Reviewer (Manager)
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: Object.values(ReviewStatus),
    default: ReviewStatus.DRAFT
  },
  
  // Self Assessment
  selfAssessment: {
    submitted: {
      type: Boolean,
      default: false
    },
    submittedAt: Date,
    strengths: {
      type: String,
      default: ''
    },
    areasForImprovement: {
      type: String,
      default: ''
    },
    goals: {
      type: String,
      default: ''
    }
  },
  
  // Manager Assessment
  managerAssessment: {
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 0
    },
    submitted: {
      type: Boolean,
      default: false
    },
    submittedAt: Date,
    performanceRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 0
    },
    qualityRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 0
    },
    teamworkRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 0
    },
    attendanceRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 0
    },
    comments: {
      type: String,
      default: ''
    },
    achievements: {
      type: String,
      default: ''
    },
    improvementAreas: {
      type: String,
      default: ''
    }
  },
  
  // KPI Scores
  kpiScores: [{
    kpi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KPI'
    },
    target: Number,
    actual: Number,
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    weight: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  
  // Peer Feedback (anonymous)
  peerFeedback: [{
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    submittedAt: {
      type: Date,
      default: Date.now
    },
    isAnonymous: {
      type: Boolean,
      default: true
    }
  }],
  
  // Final Assessment
  finalRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 0
  },
  
  // Goals
  goals: [{
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['performance', 'development', 'leadership', 'technical']
    },
    targetDate: Date,
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'overdue'],
      default: 'not_started'
    },
    completedAt: Date,
    weight: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    }
  }],
  
  // Development Plan
  developmentPlan: {
    training: [String],
    mentoring: [String],
    projects: [String],
    timeline: Date
  },
  
  // Approval
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  
  // Promotion Recommendation
  promotionRecommendation: {
    recommended: Boolean,
    level: String,
    justification: String,
    salaryIncrease: Number,
    recommendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recommendedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
performanceReviewSchema.index({ employee: 1, 'reviewPeriod.year': 1, 'reviewPeriod.period': 1 }, { unique: true });
performanceReviewSchema.index({ reviewer: 1, status: 1 });
performanceReviewSchema.index({ 'reviewPeriod.endDate': 1, status: 1 });

// Virtual for overall score
performanceReviewSchema.virtual('overallScore').get(function() {
  if (this.kpiScores && this.kpiScores.length > 0) {
    const totalWeightedScore = this.kpiScores.reduce((sum, kpi) => {
      return sum + ((kpi.score || 0) * (kpi.weight || 0) / 100);
    }, 0);
    const totalWeight = this.kpiScores.reduce((sum, kpi) => sum + (kpi.weight || 0), 0);
    return totalWeight > 0 ? totalWeightedScore : 0;
  }
  return this.finalRating * 20; // Convert 1-5 scale to percentage
});

// Virtual for completion percentage
performanceReviewSchema.virtual('completionPercentage').get(function() {
  let percentage = 0;
  if (this.selfAssessment.submitted) percentage += 25;
  if (this.managerAssessment.submitted) percentage += 50;
  if (this.status === ReviewStatus.COMPLETED) percentage = 75;
  if (this.status === ReviewStatus.APPROVED) percentage = 100;
  return percentage;
});

const PerformanceReview = mongoose.model('PerformanceReview', performanceReviewSchema);

// KPI Schema
const KPICategory = {
  PERFORMANCE: 'performance',
  QUALITY: 'quality',
  EFFICIENCY: 'efficiency',
  ATTENDANCE: 'attendance',
  SALES: 'sales',
  PROJECT: 'project',
  TEAMWORK: 'teamwork',
  LEADERSHIP: 'leadership'
};

const KPISchema = new mongoose.Schema({
  // KPI Details
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    required: true
  },
  
  category: {
    type: String,
    enum: Object.values(KPICategory),
    default: KPICategory.PERFORMANCE
  },
  
  // Measurement
  metric: {
    type: String,
    required: true
  },
  
  unit: {
    type: String,
    default: '%'
  },
  
  // Target
  target: {
    type: Number,
    default: 0
  },
  
  targetType: {
    type: String,
    enum: ['min', 'max', 'exact'],
    default: 'min'
  },
  
  // Department
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  
  // Roles this KPI applies to
  applicableRoles: [{
    type: String,
    enum: ['employee', 'manager', 'general_manager', 'admin']
  }],
  
  // Weight (for review calculations)
  weight: {
    type: Number,
    min: 0,
    max: 100,
    default: 10
  },
  
  // Active
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
KPISchema.index({ category: 1, isActive: 1 });
KPISchema.index({ department: 1, isActive: 1 });

const KPI = mongoose.model('KPI', KPISchema);

module.exports = {
  JobPosting,
  JobStatus,
  CandidateApplication,
  ApplicationStatus,
  PerformanceReview,
  ReviewStatus,
  KPI,
  KPICategory
};
