import { Request, Response, NextFunction } from 'express';
import { logger } from './logging.js';

/**
 * Error with status code
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Central error handling middleware
 * Never leaks stack traces in production
 * Always includes request ID for debugging
 */
export function errorHandler(
  err: Error | HttpError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const message = err.message || 'Internal server error';
  
  // Log error with request ID
  logger.error({
    reqId: req.id,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    statusCode,
    path: req.path,
    method: req.method,
  }, 'Request error');
  
  // Build error response
  const errorResponse: any = {
    error: message,
    reqId: req.id,
  };
  
  // Include details if available (e.g., validation errors)
  if (err instanceof HttpError && err.details) {
    errorResponse.details = err.details;
  }
  
  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler - must be registered after all routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new HttpError(404, `Not found: ${req.method} ${req.path}`);
  next(error);
}
