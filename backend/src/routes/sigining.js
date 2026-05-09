/**
 * SIGNING ROUTES – /api/sign/*
 * These are PUBLIC routes - no JWT required.
 * Access is controlled by the signer's one-time token in the URL.
 */
const express = require('express');
const router = express.Router();
const sc = require('../controllers/signingController');

// Signer lands here from their email link
router.get('/:token', sc.getSigningData);

// Serve the raw PDF for rendering in browser
router.get('/:token/file', sc.getDocumentFile);

// Signer submits their completed fields
router.post('/:token/submit', sc.submitSignatures);

// Signer declines
router.post('/:token/decline', sc.declineSignature);

module.exports = router;