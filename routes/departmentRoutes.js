const express = require('express');
const router = express.Router();
const { 
  getAllDepartments, 
  createDepartment, 
  deleteDepartment 
} = require('../controllers/departmentController');

router.get('/', getAllDepartments);
router.post('/', createDepartment);
router.delete('/:id', deleteDepartment);

module.exports = router;