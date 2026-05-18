const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads', 'cv');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function decodeFileName(name) {
  try {
    return decodeURIComponent(escape(name));
  } catch (e) {
    try {
      return Buffer.from(name, 'latin1').toString('utf8');
    } catch (e2) {
      return name;
    }
  }
}

function getExtension(name) {
  try {
    const decoded = decodeFileName(name);
    return path.extname(decoded).toLowerCase();
  } catch {
    return path.extname(name).toLowerCase();
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = getExtension(file.originalname) || '.pdf';
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = getExtension(file.originalname);
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('صيغة الملف غير مسموحة. الصيغ المسموحة: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
});

module.exports = { upload, decodeFileName };
