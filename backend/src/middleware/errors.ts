import { Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
}

export function errorHandler(logger: Logger) {
  return (err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
    // Log error (safe - no sensitive data)
    logger.error({
      error: err.message,
      statusCode: err instanceof ApiError ? err.statusCode : 500,
      path: req.path,
      method: req.method,
      stack: err.stack,
    });

    // Handle API errors
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        error: err.name,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { details: err.details }),
        timestamp: new Date().toISOString(),
      });
    }

    // Handle other errors
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
      timestamp: new Date().toISOString(),
    });
  };
}

// Common API errors
export const Errors = {
  // Authentication
  UNAUTHORIZED: new ApiError(401, 'Unauthorized'),
  TOKEN_EXPIRED: new ApiError(401, 'Token expired'),
  INVALID_TOKEN: new ApiError(401, 'Invalid token'),
  INVALID_CREDENTIALS: new ApiError(401, 'Invalid credentials'),

  // Validation
  INVALID_INPUT: (details?: string) => 
    new ApiError(400, 'Invalid input', { details }),
  PHONE_REQUIRED: new ApiError(400, 'Phone number is required'),
  INVALID_PHONE: new ApiError(400, 'Invalid phone number format'),
  CODE_REQUIRED: new ApiError(400, 'Verification code is required'),
  INVALID_CODE: new ApiError(400, 'Invalid or expired verification code'),

  // Not found
  USER_NOT_FOUND: new ApiError(404, 'User not found'),
  MESSAGE_NOT_FOUND: new ApiError(404, 'Message not found'),
  GROUP_NOT_FOUND: new ApiError(404, 'Group not found'),

  // Conflict
  USER_EXISTS: new ApiError(409, 'User already exists'),
  CONTACT_EXISTS: new ApiError(409, 'Contact already exists'),

  // Rate limiting
  TOO_MANY_ATTEMPTS: new ApiError(429, 'Too many attempts, please try again later'),
  TOO_MANY_REQUESTS: new ApiError(429, 'Too many requests, please try again later'),

  // Server errors
  DATABASE_ERROR: new ApiError(500, 'Database error'),
  SMS_ERROR: new ApiError(500, 'Failed to send SMS'),
  INTERNAL_ERROR: new ApiError(500, 'Internal server error'),
};
