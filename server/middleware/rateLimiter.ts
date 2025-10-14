import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const globalStore: RateLimitStore = {};
const WINDOW_MS = 60 * 1000; // 1 minute
const GLOBAL_MAX_REQUESTS = 500; // 500 requests per minute

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(globalStore).forEach((key) => {
    if (globalStore[key].resetTime < now) {
      delete globalStore[key];
    }
  });
}, 5 * 60 * 1000);

// Global rate limiter
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
  
  if (!globalStore[identifier] || globalStore[identifier].resetTime < now) {
    globalStore[identifier] = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
    return next();
  }
  
  globalStore[identifier].count++;
  
  if (globalStore[identifier].count > GLOBAL_MAX_REQUESTS) {
    const retryAfter = Math.ceil((globalStore[identifier].resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    res.setHeader('X-RateLimit-Limit', GLOBAL_MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', globalStore[identifier].resetTime.toString());
    
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: `${retryAfter}s`,
    });
  }
  
  res.setHeader('X-RateLimit-Limit', GLOBAL_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', (GLOBAL_MAX_REQUESTS - globalStore[identifier].count).toString());
  res.setHeader('X-RateLimit-Reset', globalStore[identifier].resetTime.toString());
  
  next();
}

// Factory function to create endpoint-specific rate limiters
export function createEndpointRateLimiter(
  maxRequests: number,
  pathPattern: string | RegExp
) {
  const store: RateLimitStore = {};
  
  // Cleanup old entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach((key) => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });
  }, 5 * 60 * 1000);

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if path matches the pattern
    const pathMatches = typeof pathPattern === 'string' 
      ? req.path.startsWith(pathPattern)
      : pathPattern.test(req.path);

    if (!pathMatches) {
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
    
    if (store[identifier].count > maxRequests) {
      const retryAfter = Math.ceil((store[identifier].resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', store[identifier].resetTime.toString());
      
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: `${retryAfter}s`,
      });
    }
    
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - store[identifier].count).toString());
    res.setHeader('X-RateLimit-Reset', store[identifier].resetTime.toString());
    
    next();
  };
}

// Endpoint-specific rate limiters
export const executeRateLimiter = createEndpointRateLimiter(30, '/api/execute');
export const authRateLimiter = createEndpointRateLimiter(30, '/api/auth');
export const chatRateLimiter = createEndpointRateLimiter(60, '/api/chat');
