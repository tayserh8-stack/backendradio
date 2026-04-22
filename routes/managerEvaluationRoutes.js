/**
 * Manager Evaluation Routes
 * Anonymous manager evaluation endpoints
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getQuestions,
  submitEvaluation,
  checkSubmissionStatus,
  getManagers,
  getResults,
  getManagerResults,
  getTrends
} = require('../controllers/managerEvaluationController');

// GET /api/manager-evaluation/questions - Get evaluation questions
router.get('/questions', protect, getQuestions);

// GET /api/manager-evaluation/status - Check if user submitted
router.get('/status', protect, checkSubmissionStatus);

// GET /api/manager-evaluation/managers - Get managers list
router.get('/managers', protect, getManagers);

// POST /api/manager-evaluation/submit - Submit evaluation
router.post('/submit', protect, submitEvaluation);

// GET /api/manager-evaluation/results - Get all results (admin only)
router.get('/results', protect, getResults);

// GET /api/manager-evaluation/manager/:id - Get specific manager results
router.get('/manager/:id', protect, getManagerResults);

// GET /api/manager-evaluation/trends - Get trends for a manager
router.get('/trends', protect, getTrends);

module.exports = router;