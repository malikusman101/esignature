const express = require('express');
const router = express.Router();
const sc = require('../controllers/signingController');

router.get('/:token', sc.getSigningData);
router.get('/:token/file', sc.getDocumentFile);
router.post('/:token/submit', sc.submitSignatures);
router.post('/:token/decline', sc.declineSignature);

module.exports = router;
