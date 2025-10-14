import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 500; // 500 requests per minute (increased from 100)

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // Skip rate limiting for static assets and Vite HMR
  if (req.path.startsWith('/assets') || 
      req.path.startsWith('/previews') || 
      req.path.startsWith('/@vite') || 
      req.path.startsWith('/@react-refresh') ||
      req.path.startsWith('/@fs') ||
      req.path.startsWith('/@replit')) {
    return next();
  }

  const identifier = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!store[identifier] || store[identifier].resetTime < now) {
    store[identifier] = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
    return next();
  }
  
  store[identifier].count++;
  
  if (store[identifier].count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((store[identifier].resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', store[identifier].resetTime.toString());
    
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: `${retryAfter}s`,
    });
  }
  
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', (MAX_REQUESTS - store[identifier].count).toString());
  res.setHeader('X-RateLimit-Reset', store[identifier].resetTime.toString());
  
  next();
}
