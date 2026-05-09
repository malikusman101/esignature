const express = require('express');
const router = express.Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', c.register);
router.post('/login', c.login);
router.post('/refresh', c.refresh);
router.get('/verify/:token', c.verifyEmail);
router.post('/forgot-password', c.forgotPassword);
router.post('/reset-password', c.resetPassword);
router.get('/me', protect, c.getMe);
router.put('/me', protect, c.updateMe);
router.post('/logout', protect, c.logout);

module.exports = router;
