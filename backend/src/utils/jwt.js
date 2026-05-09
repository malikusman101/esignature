const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const generateRefreshToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });

const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET);
const generateRandomToken = () => crypto.randomBytes(32).toString('hex');

const generateSignerToken = (signerId, documentId) =>
  jwt.sign({ signerId, documentId, type: 'signer_access' }, process.env.JWT_SECRET, { expiresIn: '30d' });

const verifySignerToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

module.exports = {
  generateAccessToken, generateRefreshToken,
  verifyAccessToken, verifyRefreshToken,
  generateRandomToken, generateSignerToken, verifySignerToken,
};
