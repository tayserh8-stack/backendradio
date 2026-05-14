/**
 * Audit Log Routes
 * Handles audit log management endpoints
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getAuditLogs,
  getAuditLogById,
  getAuditLogStats,
  exportAuditLogs,
  getAuditActions,
  getAuditEntities
} = require('../controllers/auditLogController');

// Audit log routes - specific routes must come before parameterized /:id
router.get('/', protect, getAuditLogs);
router.get('/stats', protect, getAuditLogStats);
router.get('/export', protect, exportAuditLogs);
router.get('/actions', protect, getAuditActions);
router.get('/entities', protect, getAuditEntities);
router.get('/:id', protect, getAuditLogById);

module.exports = router;