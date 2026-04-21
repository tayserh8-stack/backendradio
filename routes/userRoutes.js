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
  activateUser
} = require('../controllers/userController');
const { protect, adminOnly, managerOrAdmin } = require('../middleware/authMiddleware');

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
router.get('/rankings', protect, adminOnly, getRankings);

// GET /api/users/department-stats - Get department statistics
router.get('/department-stats', protect, managerOrAdmin, getDepartmentStats);

// GET /api/users/pending - Get pending users (admin only)
router.get('/pending', protect, adminOnly, getPendingUsers);

// POST /api/users/:id/activate - Activate user (admin only)
router.post('/:id/activate', protect, adminOnly, activateUser);

// GET /api/users/:id - Get user by ID
router.get('/:id', protect, getUserById);

// POST /api/users - Create user (admin or manager)
router.post('/', protect, managerOrAdmin, createUser);

// PUT /api/users/:id - Update user
router.put('/:id', protect, adminOnly, updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', protect, adminOnly, deleteUser);

// POST /api/users/:id/calculate-score - Calculate performance score
router.post('/:id/calculate-score', protect, managerOrAdmin, calculatePerformanceScore);

module.exports = router;