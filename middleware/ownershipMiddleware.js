const { Document } = require('../models/Document');

const documentOwnerOrAdmin = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'الملف غير موجود'
      });
    }

    const role = req.user?.role?.toLowerCase() || '';
    const isAdminOrHR = role === 'admin' || role === 'hr';
    const isOwner = document.owner.toString() === req.user._id.toString();

    if (!isOwner && !isAdminOrHR) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول لهذا الملف'
      });
    }

    req.document = document;
    next();
  } catch (error) {
    console.error('خطأ في التحقق من ملكية الملف:', error.message);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

module.exports = { documentOwnerOrAdmin };
