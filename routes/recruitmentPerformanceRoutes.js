/**
 * Recruitment & Performance Routes
 * Handles job postings, candidate applications, performance reviews, and KPIs
 */

const express = require('express');
const router = express.Router();

const {
  createJobPosting,
  getJobPostings,
  getJobPosting,
  updateJobPosting,
  deleteJobPosting,
  updateJobStatus,
  getJobStats,
  createApplication,
  getApplications,
  updateApplicationStatus,
  addInterviewFeedback,
  createPerformanceReview,
  getPerformanceReviews,
  submitSelfAssessment,
  submitManagerAssessment,
  addPeerFeedback,
  submitPromotionRecommendation,
  approvePerformanceReview,
  createKPI,
  getKPIs,
  updateKPI,
  deleteKPI
} = require('../controllers/recruitmentPerformanceController');

const { protect, adminOnly, managerOrAdmin } = require('../middleware/authMiddleware');

// =====================
// JOB POSTING ROUTES
// =====================

/**
 * @route   POST /api/recruitment/jobs
 * @desc    Create a new job posting
 * @access  Manager, Admin
 */
router.post('/jobs', protect, managerOrAdmin, createJobPosting);

/**
 * @route   GET /api/recruitment/jobs
 * @desc    Get all job postings with filters
 * @access  Public (but filtered by role)
 */
router.get('/jobs', protect, getJobPostings);

/**
 * @route   GET /api/recruitment/jobs/stats
 * @desc    Get job posting statistics
 * @access  Manager, Admin
 */
router.get('/jobs/stats', protect, managerOrAdmin, getJobStats);

/**
 * @route   GET /api/recruitment/jobs/:id
 * @desc    Get single job posting
 * @access  Public (but filtered by role)
 */
router.get('/jobs/:id', protect, getJobPosting);

/**
 * @route   PUT /api/recruitment/jobs/:id
 * @desc    Update job posting
 * @access  Hiring Manager, Admin
 */
router.put('/jobs/:id', protect, managerOrAdmin, updateJobPosting);

/**
 * @route   DELETE /api/recruitment/jobs/:id
 * @desc    Delete job posting
 * @access  Hiring Manager, Admin
 */
router.delete('/jobs/:id', protect, managerOrAdmin, deleteJobPosting);

/**
 * @route   PUT /api/recruitment/jobs/:id/status
 * @desc    Update job posting status (publish/close)
 * @access  Hiring Manager, Admin
 */
router.put('/jobs/:id/status', protect, managerOrAdmin, updateJobStatus);

// ===========================
// CANDIDATE APPLICATION ROUTES
// ===========================

/**
 * @route   POST /api/recruitment/applications
 * @desc    Create a new candidate application
 * @access  Public (no auth required)
 */
router.post('/applications', createApplication);

/**
 * @route   GET /api/recruitment/applications
 * @desc    Get all applications with filters
 * @access  Manager, Admin
 */
router.get('/applications', protect, managerOrAdmin, getApplications);

/**
 * @route   PUT /api/recruitment/applications/:id/status
 * @desc    Update application status
 * @access  Hiring Manager, Admin
 */
router.put('/applications/:id/status', protect, managerOrAdmin, updateApplicationStatus);

/**
 * @route   POST /api/recruitment/applications/:id/feedback
 * @desc    Add interview feedback
 * @access  Hiring Manager, Admin
 */
router.post('/applications/:id/feedback', protect, managerOrAdmin, addInterviewFeedback);

// =============================
// PERFORMANCE REVIEW ROUTES
// =============================

/**
 * @route   POST /api/performance/reviews
 * @desc    Create a performance review
 * @access  Manager, Admin
 */
router.post('/performance/reviews', protect, managerOrAdmin, createPerformanceReview);

/**
 * @route   GET /api/performance/reviews
 * @desc    Get performance reviews with filters
 * @access  Authenticated (filtered by role)
 */
router.get('/performance/reviews', protect, getPerformanceReviews);

/**
 * @route   PUT /api/performance/reviews/:id/self-assessment
 * @desc    Submit self assessment
 * @access  Employee (own review only)
 */
router.put('/performance/reviews/:id/self-assessment', protect, submitSelfAssessment);

/**
 * @route   PUT /api/performance/reviews/:id/manager-assessment
 * @desc    Submit manager assessment
 * @access  Manager, Admin
 */
router.put('/performance/reviews/:id/manager-assessment', protect, managerOrAdmin, submitManagerAssessment);

/**
 * @route   POST /api/performance/reviews/:id/peer-feedback
 * @desc    Add peer feedback
 * @access  Employee
 */
router.post('/performance/reviews/:id/peer-feedback', protect, addPeerFeedback);

/**
 * @route   PUT /api/performance/reviews/:id/promotion
 * @desc    Submit promotion recommendation
 * @access  Manager, Admin
 */
router.put('/performance/reviews/:id/promotion', protect, managerOrAdmin, submitPromotionRecommendation);

/**
 * @route   PUT /api/performance/reviews/:id/approve
 * @desc    Approve performance review
 * @access  Admin only
 */
router.put('/performance/reviews/:id/approve', protect, adminOnly, approvePerformanceReview);

// ============
// KPI ROUTES
// ============

/**
 * @route   POST /api/performance/kpis
 * @desc    Create a KPI
 * @access  Manager, Admin
 */
router.post('/performance/kpis', protect, managerOrAdmin, createKPI);

/**
 * @route   GET /api/performance/kpis
 * @desc    Get all KPIs
 * @access  Authenticated
 */
router.get('/performance/kpis', protect, getKPIs);

/**
 * @route   PUT /api/performance/kpis/:id
 * @desc    Update KPI
 * @access  Manager, Admin
 */
router.put('/performance/kpis/:id', protect, managerOrAdmin, updateKPI);

/**
 * @route   DELETE /api/performance/kpis/:id
 * @desc    Delete KPI
 * @access  Admin only
 */
router.delete('/performance/kpis/:id', protect, adminOnly, deleteKPI);

module.exports = router;
