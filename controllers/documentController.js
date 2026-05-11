/**
 * Document Controller
 * Handles document upload, retrieval, versioning, and access control
 */

const { Document, DocumentCategory, DocumentType, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } = require('../models/Document');
const { User } = require('../models/User');
const path = require('path');
const fs = require('fs');

/**
 * Upload a new document
 * POST /api/documents/upload
 */
const uploadDocument = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم رفع أي ملف'
      });
    }
    
    const { title, description, category, tags, isPublic, allowedUsers, allowedRoles, allowedDepartments, expiryDate, retentionPolicy } = req.body;
    
    // Validate required fields
    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: 'العنوان والفئة مطلوبان'
      });
    }
    
    // Validate category
    if (!Object.values(DocumentCategory).includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'الفئة غير صحيحة'
      });
    }
    
    // Parse tags if provided as string
    let parsedTags = [];
    if (tags) {
      parsedTags = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : tags;
    }
    
    // Parse boolean values
    const isPublicParsed = isPublic === 'true' || isPublic === true;
    
    // Parse arrays
    const allowedUsersArray = allowedUsers ? JSON.parse(allowedUsers) : [];
    const allowedRolesArray = allowedRoles ? JSON.parse(allowedRoles) : [];
    const allowedDepartmentsArray = allowedDepartments ? JSON.parse(allowedDepartments) : [];
    
    // Prepare document data
    const documentData = {
      title: title.trim(),
      description: description ? description.trim() : '',
      category,
      fileName: req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      owner: req.user._id,
      uploadedBy: req.user._id,
      tags: parsedTags,
      isPublic: isPublicParsed,
      allowedUsers: allowedUsersArray,
      allowedRoles: allowedRolesArray,
      allowedDepartments: allowedDepartmentsArray,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      retentionPolicy: retentionPolicy || 'none'
    };
    
    // Upload document
    const document = await Document.uploadDocument(documentData);
    
    res.status(201).json({
      success: true,
      message: 'تم رفع الوثيقة بنجاح',
      data: {
        document
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error.message);
    
    // Delete uploaded file if database operation failed
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      fs.unlink(filePath, (unlinkError) => {
        if (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get user's documents with filtering
 * GET /api/documents
 */
const getMyDocuments = async (req, res) => {
  try {
    const { category, tags, search, page = 1, limit = 20, versionOnly = true } = req.query;
    
    // Build query
    const query = {
      owner: req.user._id
    };
    
    // Filter by category
    if (category && Object.values(DocumentCategory).includes(category)) {
      query.category = category;
    }
    
    // Filter by version (only latest versions by default)
    if (versionOnly === 'true' || versionOnly === true) {
      query.isLatestVersion = true;
    }
    
    // Filter by tags
    if (tags) {
      const tagArray = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : tags;
      query.tags = { $in: tagArray };
    }
    
    // Search in title and description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Skip deleted/expired documents
    query.$or = query.$or || [];
    query.$and = [
      { $or: [{ expiryDate: null }, { expiryDate: { $gt: new Date() } }] }
    ];
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get documents
    const [documents, totalCount] = await Promise.all([
      Document.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('owner uploadedBy', 'username name'),
      Document.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        documents,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get document by ID
 * GET /api/documents/:id
 */
const getDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('owner uploadedBy', 'username name')
      .populate('allowedUsers', 'username name')
      .populate('parentDocument', 'title fileUrl version');
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'الوثيقة غير موجودة'
      });
    }
    
    // Check access permissions
    if (!document.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'لا لديك صلاحية للوصول إلى هذه الوثيقة'
      });
    }
    
    res.json({
      success: true,
      data: {
        document
      }
    });
  } catch (error) {
    console.error('Error fetching document:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Update document metadata
 * PUT /api/documents/:id
 */
const updateDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'الوثيقة غير موجودة'
      });
    }
    
    // Check ownership (only owner can update metadata)
    if (!document.owner.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'لا لديك صلاحية لتعديل هذه الوثيقة'
      });
    }
    
    const { title, description, category, tags, isPublic, allowedUsers, allowedRoles, allowedDepartments, expiryDate, retentionPolicy } = req.body;
    
    // Update fields if provided
    if (title !== undefined) document.title = title.trim();
    if (description !== undefined) document.description = description ? description.trim() : '';
    if (category !== undefined) {
      if (!Object.values(DocumentCategory).includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'الفئة غير صحيحة'
        });
      }
      document.category = category;
    }
    
    if (tags !== undefined) {
      document.tags = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : tags;
    }
    
    if (isPublic !== undefined) {
      document.isPublic = isPublic === 'true' || isPublic === true;
    }
    
    if (allowedUsers !== undefined) {
      document.allowedUsers = allowedUsers ? JSON.parse(allowedUsers) : [];
    }
    
    if (allowedRoles !== undefined) {
      document.allowedRoles = allowedRoles ? JSON.parse(allowedRoles) : [];
    }
    
    if (allowedDepartments !== undefined) {
      document.allowedDepartments = allowedDepartments ? JSON.parse(allowedDepartments) : [];
    }
    
    if (expiryDate !== undefined) {
      document.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }
    
    if (retentionPolicy !== undefined) {
      document.retentionPolicy = retentionPolicy;
    }
    
    await document.save();
    
    res.json({
      success: true,
      message: 'تم تحديث الوثيقة بنجاح',
      data: {
        document
      }
    });
  } catch (error) {
    console.error('Error updating document:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Delete document
 * DELETE /api/documents/:id
 */
const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'الوثيقة غير موجودة'
      });
    }
    
    // Check ownership (only owner can delete)
    if (!document.owner.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'لا لديك صلاحية لحذف هذه الوثيقة'
      });
    }
    
    // If this is the latest version, mark all versions as deleted
    if (document.isLatestVersion) {
      // Find all versions of this document
      const versions = document.parentDocument 
        ? await Document.find({ $or: [{ _id: document._id }, { parentDocument: document.parentDocument }] })
        : await Document.find({ _id: document._id });
      
      // Delete all versions
      await Document.deleteMany({ _id: { $in: versions.map(v => v._id) } });
      
      // Delete actual files
      for (const version of versions) {
        const filePath = path.join(__dirname, '..', version.fileUrl);
        fs.unlink(filePath, (unlinkError) => {
          if (unlinkError) {
            console.error('Error deleting file:', unlinkError);
          }
        });
      }
    } else {
      // Delete just this version
      const filePath = path.join(__dirname, '..', document.fileUrl);
      fs.unlink(filePath, (unlinkError) => {
        if (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      });
      
      await document.remove();
    }
    
    res.json({
      success: true,
      message: 'تم حذف الوثيقة بنجاح'
    });
  } catch (error) {
    console.error('Error deleting document:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get document versions
 * GET /api/documents/:id/versions
 */
const getDocumentVersions = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'الوثيقة غير موجودة'
      });
    }
    
    // Check access permissions
    if (!document.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'لا لديك صلاحية للوصول إلى هذه الوثيقة'
      });
    }
    
    // Find all versions
    const versions = document.parentDocument
      ? await Document.find({ $or: [{ _id: document._id }, { parentDocument: document.parentDocument }] })
        .sort({ version: -1 })
      : await Document.find({ _id: document._id })
        .sort({ version: -1 });
    
    res.json({
      success: true,
      data: {
        versions
      }
    });
  } catch (error) {
    console.error('Error fetching document versions:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get document categories
 * GET /api/documents/categories
 */
const getDocumentCategories = async (req, res) => {
  try {
    const categories = Object.values(DocumentCategory).map(category => ({
      value: category,
      label: category
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }));
    
    res.json({
      success: true,
      data: {
        categories
      }
    });
  } catch (error) {
    console.error('Error fetching document categories:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get allowed file types
 * GET /api/documents/file-types
 */
const getAllowedFileTypes = async (req, res) => {
  try {
    const fileTypes = Object.entries(DocumentType).map(([key, value]) => ({
      extension: key.toLowerCase(),
      mimeType: value,
      description: `${key.toUpperCase()} File`
    }));
    
    res.json({
      success: true,
      data: {
        fileTypes,
        maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024),
        allowedExtensions: ALLOWED_EXTENSIONS
      }
    });
  } catch (error) {
    console.error('Error fetching file types:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

module.exports = {
  uploadDocument,
  getMyDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentVersions,
  getDocumentCategories,
  getAllowedFileTypes
};