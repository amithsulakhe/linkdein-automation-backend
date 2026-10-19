import { ApiError } from '../utils/apiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: 'Not found' });
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
    });
  }
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors,
    });
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
