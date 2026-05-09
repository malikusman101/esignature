const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('./errorHandler');

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
['originals','signed','audits','temp'].forEach((sub) => {
  const dir = path.join(uploadDir, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(uploadDir, 'originals')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['application/pdf','image/png','image/jpeg','image/jpg'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new ApiError(415, 'Only PDF, PNG, and JPEG allowed.'), false);
};

const upload = multer({
  storage, fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10*1024*1024, files: 1 },
});

module.exports = upload;
