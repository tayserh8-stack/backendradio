/**
 * Task Model
 * Represents tasks assigned to employees
 */

const mongoose = require('mongoose');

// Task status enum
const TaskStatus = {
  PENDING: 'pending',           // Pending assignment
  IN_PROGRESS: 'in_progress',   // In progress
  COMPLETED: 'completed',       // Completed
  APPROVED: 'approved',         // Approved by manager
  FINAL_APPROVED: 'final_approved'  // Approved by admin
};

// Task difficulty percentages
const TaskDifficulty = {
  EASY: 20,
  MEDIUM: 50,
  HARD: 100
};

// Task Schema
const taskSchema = new mongoose.Schema({
  // Task name
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  // Task description
  description: {
    type: String,
    default: ''
  },
  
  // Who created the task (manager or employee themselves)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Assigned employees
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Task status
  status: {
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.PENDING
  },
  
  // Task difficulty percentage (20, 50, or 100)
  difficulty: {
    type: Number,
    enum: [TaskDifficulty.EASY, TaskDifficulty.MEDIUM, TaskDifficulty.HARD],
    default: TaskDifficulty.MEDIUM
  },
  
  // Is this an unusual task
  isUnusual: {
    type: Boolean,
    default: false
  },
  
  // Work duration in hours
  duration: {
    type: Number,
    default: 0
  },
  
  // Start time
  startTime: {
    type: Date,
    default: null
  },
  
  // End time
  endTime: {
    type: Date,
    default: null
  },
  
  // Manager evaluation score (0-100)
  managerScore: {
    type: Number,
    default: null
  },
  
  // Manager notes
  managerNotes: {
    type: String,
    default: ''
  },
  
  // Is approved by manager
  isApprovedByManager: {
    type: Boolean,
    default: false
  },
  
  // Approval date by manager
  managerApprovalDate: {
    type: Date,
    default: null
  },
  
  // Task date (for daily tasks)
  taskDate: {
    type: Date,
    default: Date.now
  },
  
  // Due date
  dueDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for better query performance
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ createdBy: 1, status: 1 });
taskSchema.index({ taskDate: 1 });

// Virtual for checking if task is overdue
taskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return this.status !== TaskStatus.COMPLETED && new Date() > this.dueDate;
});

// Method to mark as completed
taskSchema.methods.markCompleted = function() {
  this.status = TaskStatus.COMPLETED;
  this.endTime = new Date();
  return this.save();
};

// Method to approve by manager
taskSchema.methods.approveByManager = function(score, notes) {
  this.isApprovedByManager = true;
  this.managerScore = score;
  this.managerNotes = notes;
  this.status = TaskStatus.APPROVED;
  this.managerApprovalDate = new Date();
  return this.save();
};

const Task = mongoose.model('Task', taskSchema);

module.exports = { Task, TaskStatus, TaskDifficulty };