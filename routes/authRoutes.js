/**
 * Auth Routes
 * Authentication endpoints
 */

const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getMe, 
  changePassword,
  updateProfile,
  updateProfileImage 
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// POST /api/auth/register - Register new user
router.post('/register', register);

// POST /api/auth/login - Login user
router.post('/login', login);

// GET /api/auth/me - Get current user
router.get('/me', protect, getMe);

// POST /api/auth/change-password - Change password
router.post('/change-password', protect, changePassword);

// PUT /api/auth/profile - Update profile
router.put('/profile', protect, updateProfile);

// PUT /api/auth/profile-image - Update profile image
router.put('/profile-image', protect, upload.single('profileImage'), updateProfileImage);

module.exports = router;