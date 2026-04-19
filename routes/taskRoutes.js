/**
 * Task Routes
 * Task management endpoints
 */

const express = require('express');
const router = express.Router();
const { 
  createTask,
  getMyTasks,
  getCreatedTasks,
  getTasksToEvaluate,
  getTasksToApprove,
  updateTaskStatus,
  evaluateTask,
  finalApproveTask,
  getTaskById,
  updateTask,
  deleteTask,
  getDailySummary,
  getWeeklySummary,
  getTaskReports,
  getTotalTasks
} = require('../controllers/taskController');
const { protect, managerOrAdmin, adminOnly } = require('../middleware/authMiddleware');

// POST /api/tasks - Create task
router.post('/', protect, createTask);

// GET /api/tasks/my-tasks - Get my tasks
router.get('/my-tasks', protect, getMyTasks);

// GET /api/tasks/created - Get tasks I created
router.get('/created', protect, getCreatedTasks);

// GET /api/tasks/to-evaluate - Get tasks to evaluate (manager)
router.get('/to-evaluate', protect, managerOrAdmin, getTasksToEvaluate);

// GET /api/tasks/to-approve - Get tasks to approve (admin)
router.get('/to-approve', protect, adminOnly, getTasksToApprove);

// GET /api/tasks/summary/daily - Get daily summary
router.get('/summary/daily', protect, getDailySummary);

// GET /api/tasks/summary/weekly - Get weekly summary
router.get('/summary/weekly', protect, getWeeklySummary);

// GET /api/tasks/reports - Get task reports
router.get('/reports', protect, managerOrAdmin, getTaskReports);

// GET /api/tasks/total - Get total tasks count (all time)
router.get('/total', protect, getTotalTasks);

// GET /api/tasks/:id - Get task by ID
router.get('/:id', protect, getTaskById);

// PUT /api/tasks/:id - Update task
router.put('/:id', protect, updateTask);

// PUT /api/tasks/:id/status - Update task status
router.put('/:id/status', protect, updateTaskStatus);

// POST /api/tasks/:id/evaluate - Evaluate task (manager)
router.post('/:id/evaluate', protect, managerOrAdmin, evaluateTask);

// POST /api/tasks/:id/final-approve - Final approve (admin)
router.post('/:id/final-approve', protect, adminOnly, finalApproveTask);

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', protect, deleteTask);

module.exports = router;