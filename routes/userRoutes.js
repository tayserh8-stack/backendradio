/**
 * User Routes
 * User management endpoints
 */

const express = require('express');
const router = express.Router();
const { 
  getAllEmployees,
  getEmployeesByDepartment,
  getAllManagers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  calculatePerformanceScore,
  getRankings,
  getDepartmentStats,
  getPendingUsers,
  activateUser,
  getUserCounts,
  changePassword
} = require('../controllers/userController');
const { protect, adminOnly, adminOrHR, managerOrAdmin } = require('../middleware/authMiddleware');
const { getEmployeeProfile, updateEmployeeProfile, uploadCV, deleteCV } = require('../controllers/employeeProfileController');
const cvUploadMiddleware = require('../middleware/cvUploadMiddleware');
const cvUpload = cvUploadMiddleware.upload;

// GET /api/users/employees - Get all employees
router.get('/employees', protect, managerOrAdmin, getAllEmployees);

// GET /api/users - Get all users (for messaging)
router.get('/', protect, async (req, res) => {
  try {
    console.log('Fetching all users...');
    const { User } = require('../models/User');
    const users = await User.find().select('-password').sort({ name: 1 });
    console.log('Found users:', users.length);
    res.json({ success: true, data: { users } });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Error fetching users: ' + error.message });
  }
});

// GET /api/users/department/:department - Get employees by department
router.get('/department/:department', protect, managerOrAdmin, getEmployeesByDepartment);

// GET /api/users/managers - Get all managers
router.get('/managers', protect, managerOrAdmin, getAllManagers);

// GET /api/users/rankings - Get employee rankings
router.get('/rankings', protect, adminOrHR, getRankings);

// GET /api/users/department-stats - Get department statistics
router.get('/department-stats', protect, managerOrAdmin, getDepartmentStats);

// GET /api/users/pending - Get pending users (admin or HR)
router.get('/pending', protect, adminOrHR, getPendingUsers);

// GET /api/users/counts - Get user counts (employees and managers)
router.get('/counts', protect, adminOrHR, getUserCounts);

// POST /api/users/:id/activate - Activate user (admin or HR)
router.post('/:id/activate', protect, adminOrHR, activateUser);

// GET /api/users/:id - Get user by ID
router.get('/:id', protect, getUserById);

// POST /api/users - Create user (admin or manager)
router.post('/', protect, managerOrAdmin, createUser);

// PUT /api/users/change-password - Change password (authenticated user)
router.put('/change-password', protect, changePassword);

// PUT /api/users/:id - Update user (admin or HR)
router.put('/:id', protect, adminOrHR, updateUser);

// DELETE /api/users/:id - Delete user (admin or HR)
router.delete('/:id', protect, adminOrHR, deleteUser);

// POST /api/users/:id/calculate-score - Calculate performance score
router.post('/:id/calculate-score', protect, managerOrAdmin, calculatePerformanceScore);

// Employee Profile Routes (Admin/HR only)
// GET /api/users/profile/:id - Get full employee profile
router.get('/profile/:id', protect, adminOrHR, getEmployeeProfile);

// PUT /api/users/profile/:id - Update employee profile
router.put('/profile/:id', protect, adminOrHR, updateEmployeeProfile);

// POST /api/users/profile/:id/cv - Upload employee CV
router.post('/profile/:id/cv', protect, adminOrHR, cvUpload.single('cv'), uploadCV);

// DELETE /api/users/profile/:id/cv - Delete employee CV
router.delete('/profile/:id/cv', protect, adminOrHR, deleteCV);

module.exports = router;