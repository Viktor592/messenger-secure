import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Error handler middleware
 */
export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  // Log unexpected errors
  logger.error({
    error: err.message,
    stack: err.stack,
  });

  return res.status(500).json({
    error: 'Internal server error',
  });
};

/**
 * Predefined errors
 */
export const Errors = {
  PHONE_REQUIRED: new ApiError(400, 'Phone number is required'),
  INVALID_PHONE: new ApiError(400, 'Invalid phone number format'),
  INVALID_TOKEN: new ApiError(401, 'Invalid or expired token'),
  INVALID_CODE: new ApiError(400, 'Invalid verification code'),
  TOO_MANY_ATTEMPTS: new ApiError(429, 'Too many attempts, please try again later'),
  UNAUTHORIZED: new ApiError(401, 'Unauthorized'),
  FORBIDDEN: new ApiError(403, 'Forbidden'),
  NOT_FOUND: new ApiError(404, 'Not found'),
  CONFLICT: new ApiError(409, 'Resource already exists'),
};
