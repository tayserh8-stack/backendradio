/**
 * Settings Routes
 * Application settings endpoints
 */

const express = require('express');
const router = express.Router();
const { 
  getAllSettings,
  getSetting,
  updateSetting,
  updateMultipleSettings,
  getEvaluationWeights,
  resetSettings
} = require('../controllers/settingsController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// GET /api/settings - Get all settings
router.get('/', protect, getAllSettings);

// GET /api/settings/weights - Get evaluation weights
router.get('/weights', protect, getEvaluationWeights);

// GET /api/settings/:key - Get single setting
router.get('/:key', protect, getSetting);

// PUT /api/settings/:key - Update single setting
router.put('/:key', protect, adminOnly, updateSetting);

// PUT /api/settings - Update multiple settings
router.put('/', protect, adminOnly, updateMultipleSettings);

// POST /api/settings/reset - Reset to defaults
router.post('/reset', protect, adminOnly, resetSettings);

module.exports = router;