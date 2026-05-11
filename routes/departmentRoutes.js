const express = require('express');
const router = express.Router();
const { 
  getAllDepartments, 
  createDepartment, 
  updateDepartment,
  deleteDepartment,
  getDepartmentCosts
} = require('../controllers/departmentController');
const { protect, adminOnly, managerOrAdmin } = require('../middleware/authMiddleware');

router.get('/', protect, getAllDepartments);
router.get('/costs', protect, managerOrAdmin, getDepartmentCosts);
router.post('/', protect, adminOnly, createDepartment);
router.put('/:id', protect, adminOnly, updateDepartment);
router.delete('/:id', protect, adminOnly, deleteDepartment);

module.exports = router;