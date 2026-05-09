/**
 * UPLOAD MIDDLEWARE
 *
 * Wraps multer with:
 *  - disk storage (files saved to uploads/originals/)
 *  - file type whitelist (PDF, PNG, JPG only)
 *  - 10 MB size limit
 *  - unique filename generation so originals are never overwritten
 *
 * Usage in routes:
 *   router.post('/documents', protect, upload.single('file'), handler)
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('./errorHandler');

// Ensure upload directories exist at startup
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
['originals', 'signed', 'audits', 'temp'].forEach((sub) => {
  const dir = path.join(uploadDir, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created upload directory: ${dir}`);
  }
});

// ── Storage engine ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadDir, 'originals'));
  },
  filename: (req, file, cb) => {
    // Format: <uuid>_<timestamp><ext>  e.g. 3f2a..._1700000000000.pdf
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

// ── File type filter ──────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(415, 'Unsupported file type. Only PDF, PNG, and JPEG are allowed.'),
      false
    );
  }
};

// ── Multer instance ───────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

module.exports = upload;