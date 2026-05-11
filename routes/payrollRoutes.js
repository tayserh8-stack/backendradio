/**
 * Payroll Routes
 * Handles payroll management, payslip generation, and financial operations
 */
const express = require('express');
const router = express.Router();
const {
  getPayrollByEmployee, getAllPayrolls, generatePayroll, updatePayroll,
  approvePayroll, markAsPaid, deletePayroll, getPayrollSummary,
  generatePayslip, getPendingPayrollAssignments, assignSalaryToPendingPayroll,
  getRecentPayments, getCurrentPayslip, exportPayslipPDF,
} = require('../controllers/payrollController');
const { protect, adminOnly, managerOrAdmin } = require('../middleware/authMiddleware');

router.get('/employee/:employeeId', protect, getPayrollByEmployee);
router.get('/all', protect, managerOrAdmin, getAllPayrolls);
router.post('/generate', protect, managerOrAdmin, generatePayroll);
router.put('/:id', protect, managerOrAdmin, updatePayroll);
router.put('/:id/approve', protect, adminOnly, approvePayroll);
router.put('/:id/pay', protect, managerOrAdmin, markAsPaid);
router.delete('/:id', protect, deletePayroll);
router.get('/summary', protect, managerOrAdmin, getPayrollSummary);
router.get('/pending-assignments', protect, getPendingPayrollAssignments);
router.put('/:id/assign-salary', protect, assignSalaryToPendingPayroll);
router.get('/recent', protect, managerOrAdmin, getRecentPayments);
router.get('/:id/payslip', protect, generatePayslip);

// New payslip endpoints
router.get('/payslip/current', protect, getCurrentPayslip);
router.get('/:id/payslip/export', protect, exportPayslipPDF);

module.exports = router;