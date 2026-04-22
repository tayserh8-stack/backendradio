/**
 * Well-Being Routes
 * Employee well-being check-in endpoints
 */

var express = require('express');
var router = express.Router();
var authMiddleware = require('../middleware/authMiddleware');
var controller = require('../controllers/wellBeingController');

router.get('/status', authMiddleware.protect, controller.getStatus);
router.post('/submit', authMiddleware.protect, controller.submitCheckIn);
router.get('/stats', authMiddleware.protect, authMiddleware.managerOrAdmin, controller.getTodayStats);
router.get('/trends', authMiddleware.protect, authMiddleware.managerOrAdmin, controller.getTrends);
router.get('/burnout-risk', authMiddleware.protect, authMiddleware.managerOrAdmin, controller.getBurnoutRisk);
router.get('/department', authMiddleware.protect, authMiddleware.managerOrAdmin, controller.getDepartmentStats);

module.exports = router;