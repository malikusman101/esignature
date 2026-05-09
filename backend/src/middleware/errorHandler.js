const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  if (err.name === 'SequelizeValidationError') {
    statusCode = 422; message = 'Validation Error';
    errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409; message = 'A record with that value already exists';
  }
  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Token expired'; }
  if (err.code === 'LIMIT_FILE_SIZE') { statusCode = 413; message = 'File too large. Max 10MB.'; }

  if (!err.isOperational) console.error('💥 ERROR:', err);

  res.status(statusCode).json({
    success: false, message,
    errors: errors.length > 0 ? errors : undefined,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const notFound = (req, res, next) =>
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));

module.exports = { asyncHandler, ApiError, errorHandler, notFound };
