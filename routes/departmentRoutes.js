const express = require('express');
const router = express.Router();
const { 
  getAllDepartments, 
  createDepartment, 
  updateDepartment,
  deleteDepartment,
  getDepartmentCosts,
  getDepartmentStats
} = require('../controllers/departmentController');
const { protect, adminOnly, adminOrHR, managerOrAdmin } = require('../middleware/authMiddleware');

router.get('/', protect, getAllDepartments);
router.get('/stats', protect, managerOrAdmin, getDepartmentStats);
router.get('/costs', protect, managerOrAdmin, getDepartmentCosts);
router.post('/', protect, adminOrHR, createDepartment);
router.put('/:id', protect, adminOrHR, updateDepartment);
router.delete('/:id', protect, adminOrHR, deleteDepartment);

module.exports = router;