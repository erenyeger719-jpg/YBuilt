import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type to include id
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

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
  req.id = (req.headers['x-request-id'] as string) || uuidv4();
  
  // Set response header
  res.setHeader('X-Request-Id', req.id);
  
  next();
}

/**
 * Request logger middleware
 * Logs request method, path, status code, and response time
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, path } = req;
    const { statusCode } = res;
    
    console.log(`[${req.id}] ${method} ${path} ${statusCode} - ${duration}ms`);
  });
  
  next();
}
