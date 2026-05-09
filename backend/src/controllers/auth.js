/**
 * AUTH CONTROLLER
 *
 * POST /api/auth/register     – create account, send verification email
 * POST /api/auth/login        – login, return access + refresh tokens
 * POST /api/auth/refresh      – exchange refresh token for new access token
 * GET  /api/auth/verify/:token – verify email address
 * POST /api/auth/forgot-password – send reset link
 * POST /api/auth/reset-password  – set new password
 * GET  /api/auth/me           – return current user profile
 * PUT  /api/auth/me           – update profile / save signature
 * POST /api/auth/logout       – invalidate refresh token
 */

const { User } = require('../models');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateRandomToken,
} = require('../utils/jwt');
const { sendEmail } = require('../services/emailService');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

// ── REGISTER ──────────────────────────────────────────────────────────────────
exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // 1. Check for duplicate email
  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  // 2. Create user (password is hashed in User model beforeCreate hook)
  const verificationToken = generateRandomToken();
  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    password,
    verificationToken,
  });

  // 3. Send verification email (non-blocking – don't fail registration if email fails)
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
  try {
    await sendEmail({
      to: user.email,
      template: 'welcome',
      data: [user.firstName, verifyUrl],
    });
  } catch (emailErr) {
    console.error('⚠️  Verification email failed to send:', emailErr.message);
  }

  // 4. Generate tokens
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // 5. Store refresh token in DB (hashed in production would be better – simplified here)
  await user.update({ refreshToken });

  res.status(201).json({
    success: true,
    message: 'Account created! Please check your email to verify your account.',
    data: {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    },
  });
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 1. Find user (include password for comparison)
  const user = await User.findOne({
    where: { email: email.toLowerCase() },
    attributes: { include: ['password'] }, // password is normally hidden via toJSON
  });

  // Use same error for both "not found" and "wrong password" to prevent enumeration
  const invalidError = new ApiError(401, 'Invalid email or password.');

  if (!user) throw invalidError;
  if (!user.isActive) throw new ApiError(401, 'Your account has been deactivated. Contact support.');

  // 2. Compare password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw invalidError;

  // 3. Update last login
  await user.update({ lastLoginAt: new Date() });

  // 4. Generate tokens
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);
  await user.update({ refreshToken });

  res.json({
    success: true,
    message: 'Login successful.',
    data: {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    },
  });
});

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(401, 'Refresh token required.');

  // 1. Verify JWT signature
  const decoded = verifyRefreshToken(refreshToken);

  // 2. Check token matches what's stored (single-use rotation)
  const user = await User.findByPk(decoded.userId);
  if (!user || user.refreshToken !== refreshToken) {
    throw new ApiError(401, 'Invalid refresh token. Please login again.');
  }

  // 3. Issue new pair
  const newAccessToken = generateAccessToken(user.id, user.role);
  const newRefreshToken = generateRefreshToken(user.id);
  await user.update({ refreshToken: newRefreshToken });

  res.json({
    success: true,
    data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
  });
});

// ── VERIFY EMAIL ──────────────────────────────────────────────────────────────
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({ where: { verificationToken: token } });
  if (!user) throw new ApiError(400, 'Invalid or expired verification token.');

  await user.update({ isVerified: true, verificationToken: null });

  res.json({ success: true, message: 'Email verified successfully! You can now login.' });
});

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ where: { email: email.toLowerCase() } });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  }

  const resetToken = generateRandomToken();
  await user.update({
    resetPasswordToken: resetToken,
    resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {
    await sendEmail({
      to: user.email,
      template: 'resetPassword',
      data: [user.firstName, resetUrl],
    });
  } catch (emailErr) {
    console.error('⚠️  Reset email failed:', emailErr.message);
  }

  res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
});

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    where: { resetPasswordToken: token },
    attributes: { include: ['resetPasswordToken', 'resetPasswordExpires'] },
  });

  if (!user) throw new ApiError(400, 'Invalid or expired reset token.');
  if (user.resetPasswordExpires < new Date()) {
    throw new ApiError(400, 'Reset token has expired. Please request a new one.');
  }

  await user.update({
    password,
    resetPasswordToken: null,
    resetPasswordExpires: null,
    refreshToken: null, // log out all sessions
  });

  res.json({ success: true, message: 'Password reset successful. Please login with your new password.' });
});

// ── GET ME ────────────────────────────────────────────────────────────────────
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) throw new ApiError(404, 'User not found.');

  res.json({ success: true, data: { user } });
});

// ── UPDATE ME ─────────────────────────────────────────────────────────────────
exports.updateMe = asyncHandler(async (req, res) => {
  const allowedFields = ['firstName', 'lastName', 'timezone', 'signatureData', 'initials'];
  const updates = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  // Handle password change
  if (req.body.currentPassword && req.body.newPassword) {
    const user = await User.findByPk(req.user.id, { attributes: { include: ['password'] } });
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) throw new ApiError(400, 'Current password is incorrect.');
    updates.password = req.body.newPassword;
  }

  await req.user.update(updates);
  const updatedUser = await User.findByPk(req.user.id);

  res.json({ success: true, message: 'Profile updated.', data: { user: updatedUser } });
});

// ── LOGOUT ────────────────────────────────────────────────────────────────────
exports.logout = asyncHandler(async (req, res) => {
  await req.user.update({ refreshToken: null });
  res.json({ success: true, message: 'Logged out successfully.' });
});