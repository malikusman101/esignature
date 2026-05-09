/**
 * AUTH MIDDLEWARE
 *
 * protect()      – verifies the Bearer JWT in Authorization header.
 *                  Attaches req.user for downstream controllers.
 *
 * authorize(...) – role-based guard. Call after protect().
 *
 * optionalAuth() – same as protect but doesn't fail on missing token.
 *                  Used for public signing routes where we need to
 *                  know IF a user is logged in but don't require it.
 */

const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');

/**
 * Extract the Bearer token from the Authorization header.
 * Returns null if not present or malformed.
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Also allow token in cookie (useful for download links)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};

// ── protect ───────────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // Verify signature & expiry
    const decoded = verifyAccessToken(token);

    // Load fresh user from DB so revoked accounts are caught
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    next(error);
  }
};

// ── authorize ─────────────────────────────────────────────────────────────────
// Usage: router.delete('/users/:id', protect, authorize('admin'), handler)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not allowed to access this resource.`,
      });
    }
    next();
  };
};

// ── optionalAuth ──────────────────────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next(); // no token → continue unauthenticated

    const decoded = verifyAccessToken(token);
    const user = await User.findByPk(decoded.userId);
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // invalid token → just continue without user
  }
  next();
};

module.exports = { protect, authorize, optionalAuth };