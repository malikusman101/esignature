const express = require('express');
const router = express.Router();
const dc = require('../controllers/documentController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
router.get('/stats', dc.getDashboardStats);
router.route('/').get(dc.getDocuments).post(upload.single('file'), dc.uploadDocument);
router.route('/:id').get(dc.getDocument).put(dc.updateDocument).delete(dc.voidDocument);
router.post('/:id/send', dc.sendDocument);
router.post('/:id/remind', dc.sendReminder);
router.post('/:id/void', dc.voidDocument);
router.get('/:id/download', dc.downloadDocument);
router.get('/:id/audit', dc.downloadAuditTrail);

module.exports = router;
