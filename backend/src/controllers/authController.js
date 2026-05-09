const { User } = require('../models');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, generateRandomToken } = require('../utils/jwt');
const { sendEmail } = require('../services/email');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) throw new ApiError(409, 'Email already registered.');
  const verificationToken = generateRandomToken();
  const user = await User.create({ firstName, lastName, email: email.toLowerCase(), password, verificationToken });
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);
  await user.update({ refreshToken });
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
  sendEmail({ to: user.email, template: 'welcome', data: [user.firstName, verifyUrl] });
  res.status(201).json({ success: true, message: 'Account created!', data: { user: user.toJSON(), accessToken, refreshToken } });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email: email.toLowerCase() }, attributes: { include: ['password'] } });
  if (!user || !(await user.comparePassword(password)))
    throw new ApiError(401, 'Invalid email or password.');
  if (!user.isActive) throw new ApiError(401, 'Account deactivated.');
  await user.update({ lastLoginAt: new Date() });
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);
  await user.update({ refreshToken });
  res.json({ success: true, data: { user: user.toJSON(), accessToken, refreshToken } });
});

exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(401, 'Refresh token required.');
  const decoded = verifyRefreshToken(refreshToken);
  const user = await User.findByPk(decoded.userId);
  if (!user || user.refreshToken !== refreshToken) throw new ApiError(401, 'Invalid refresh token.');
  const newAccessToken = generateAccessToken(user.id, user.role);
  const newRefreshToken = generateRefreshToken(user.id);
  await user.update({ refreshToken: newRefreshToken });
  res.json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ where: { verificationToken: req.params.token } });
  if (!user) throw new ApiError(400, 'Invalid verification token.');
  await user.update({ isVerified: true, verificationToken: null });
  res.json({ success: true, message: 'Email verified!' });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ where: { email: req.body.email?.toLowerCase() } });
  if (user) {
    const resetToken = generateRandomToken();
    await user.update({ resetPasswordToken: resetToken, resetPasswordExpires: new Date(Date.now()+3600000) });
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    sendEmail({ to: user.email, template: 'resetPassword', data: [user.firstName, resetUrl] });
  }
  res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const user = await User.findOne({ where: { resetPasswordToken: token }, attributes: { include: ['resetPasswordExpires'] } });
  if (!user || user.resetPasswordExpires < new Date()) throw new ApiError(400, 'Invalid or expired token.');
  await user.update({ password, resetPasswordToken: null, resetPasswordExpires: null, refreshToken: null });
  res.json({ success: true, message: 'Password reset. Please login.' });
});

exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  res.json({ success: true, data: { user } });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const allowed = ['firstName','lastName','timezone','signatureData','initials'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (req.body.currentPassword && req.body.newPassword) {
    const user = await User.findByPk(req.user.id, { attributes: { include: ['password'] } });
    if (!(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Wrong current password.');
    updates.password = req.body.newPassword;
  }
  await req.user.update(updates);
  const user = await User.findByPk(req.user.id);
  res.json({ success: true, data: { user } });
});

exports.logout = asyncHandler(async (req, res) => {
  await req.user.update({ refreshToken: null });
  res.json({ success: true, message: 'Logged out.' });
});
