const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } = require('../models/Document');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const extension = `.${file.originalname.split('.').pop().toLowerCase()}`;
  
  if (ALLOWED_EXTENSIONS.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error(`File extension ${extension} is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

module.exports = upload;