/**
 * ERROR HANDLING MIDDLEWARE
 *
 * asyncHandler – wraps async route handlers so you never need try/catch.
 *   Instead of: try { ... } catch(e) { next(e) }
 *   Just:       asyncHandler(async (req, res) => { ... })
 *
 * errorHandler – Express error middleware (4-arg signature).
 *   Converts all errors into a consistent JSON shape.
 *   Must be registered LAST in app.js (after all routes).
 */

// ── asyncHandler ──────────────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
  
  // ── ApiError ──────────────────────────────────────────────────────────────────
  // Throw this anywhere to produce a clean HTTP error response.
  class ApiError extends Error {
    constructor(statusCode, message, errors = []) {
      super(message);
      this.statusCode = statusCode;
      this.errors = errors;
      this.isOperational = true;
    }
  }
  
  // ── errorHandler ──────────────────────────────────────────────────────────────
  const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || [];
  
    // Sequelize validation errors
    if (err.name === 'SequelizeValidationError') {
      statusCode = 422;
      message = 'Validation Error';
      errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
    }
  
    // Sequelize unique constraint
    if (err.name === 'SequelizeUniqueConstraintError') {
      statusCode = 409;
      message = 'A record with that value already exists';
      errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
    }
  
    // Sequelize FK constraint
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      statusCode = 400;
      message = 'Referenced record does not exist';
    }
  
    // JWT errors (shouldn't reach here normally, caught in auth middleware)
    if (err.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Invalid token';
    }
    if (err.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token expired';
    }
  
    // Multer file too large
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      message = 'File is too large. Maximum size is 10MB.';
    }
  
    // Log non-operational errors (real bugs) fully
    if (!err.isOperational) {
      console.error('💥 UNHANDLED ERROR:', err);
    }
  
    res.status(statusCode).json({
      success: false,
      message,
      errors: errors.length > 0 ? errors : undefined,
      // Only include stack trace in development
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  };
  
  // ── notFound ──────────────────────────────────────────────────────────────────
  // Register before errorHandler to catch unmatched routes
  const notFound = (req, res, next) => {
    next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
  };
  
  module.exports = { asyncHandler, ApiError, errorHandler, notFound };
  