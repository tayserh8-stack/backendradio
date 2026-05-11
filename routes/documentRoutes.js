/**
 * Document Routes
 * Handles document management endpoints
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  uploadDocument,
  getMyDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentVersions,
  getDocumentCategories,
  getAllowedFileTypes
} = require('../controllers/documentController');
const upload = require('../middleware/documentUploadMiddleware');

// Document upload route
router.post('/upload', protect, upload.single('file'), uploadDocument);

// Get user's documents
router.get('/', protect, getMyDocuments);

// Get document by ID
router.get('/:id', protect, getDocumentById);

// Update document metadata
router.put('/:id', protect, updateDocument);

// Delete document
router.delete('/:id', protect, deleteDocument);

// Get document versions
router.get('/:id/versions', protect, getDocumentVersions);

// Get document categories
router.get('/categories', protect, getDocumentCategories);

// Get allowed file types
router.get('/file-types', protect, getAllowedFileTypes);

module.exports = router;