import { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { nanoid } from 'nanoid';

// Extend Express Request type to include id
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Pino logger instance
 * Pretty print in development, JSON in production
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

/**
 * Request ID middleware
 * Generates or uses existing request ID from 'x-request-id' header
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Use existing request ID or generate new one
  req.id = (req.headers['x-request-id'] as string) || nanoid(12);
  
  // Set response header
  res.setHeader('X-Request-Id', req.id);
  
  next();
}

/**
 * Request logger middleware
 * Logs request method, path, status code, and response time with request ID
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  
  // Log request start
  logger.info({
    reqId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
  }, 'Incoming request');
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, path } = req;
    const { statusCode } = res;
    
    const logData = {
      reqId: req.id,
      method,
      path,
      statusCode,
      duration,
    };
    
    if (statusCode >= 500) {
      logger.error(logData, 'Request error');
    } else if (statusCode >= 400) {
      logger.warn(logData, 'Request warning');
    } else {
      logger.info(logData, 'Request complete');
    }
  });
  
  next();
}
