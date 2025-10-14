import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "./logging.js";

// SECURITY: JWT_SECRET is required and must be set in environment variables
// Fail fast if not configured to prevent security vulnerabilities
const NODE_ENV = process.env.NODE_ENV || 'production';
let JWT_SECRET: string;

if (!process.env.JWT_SECRET) {
  if (NODE_ENV === 'development') {
    // Allow development fallback with clear warning
    JWT_SECRET = 'dev-secret-change-in-production';
    console.warn('⚠️  Using development JWT_SECRET. Set JWT_SECRET env var for production!');
  } else {
    // Production or any other environment: require JWT_SECRET
    throw new Error(
      'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is required but not set. ' +
      'Generate a secure secret with: openssl rand -base64 32'
    );
  }
} else {
  JWT_SECRET = process.env.JWT_SECRET;
}
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "7d";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user: { id: number; email: string } | null;
    }
  }
}

export interface JWTPayload {
  sub: number;
  email: string;
}

/**
 * Generate JWT token for authenticated user (HS256)
 */
export function signJwt(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Type guard: jwt.verify can return string | JwtPayload
    if (typeof decoded === 'string') {
      throw new Error("Invalid token payload format");
    }
    
    // Validate required fields exist and have correct types
    if (!decoded || typeof decoded !== 'object') {
      throw new Error("Invalid token payload");
    }
    
    if (typeof decoded.sub !== 'number' || typeof decoded.email !== 'string') {
      throw new Error("Invalid token payload: missing or invalid required fields");
    }
    
    // Now we can safely cast to our JWTPayload type
    return decoded as unknown as JWTPayload;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Invalid or expired token");
  }
}

/**
 * Optional authentication middleware
 * Extracts token from 'Authorization: Bearer <token>' header
 * - If no token, set req.user = null and continue
 * - If token exists, verify using jsonwebtoken and JWT_SECRET
 * - On valid token: attach req.user = { id, email } from JWT payload
 * - On invalid token: return 401 with error message
 */
export function authOptional(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      req.user = null;
      next();
      return;
    }

    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch (error) {
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

/**
 * Required authentication middleware
 * Extracts token from 'Authorization: Bearer <token>' header
 * - If no token, return 401
 * - If token invalid, return 401
 * - On valid token: attach req.user = { id, email } from JWT payload
 */
export function authRequired(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch (error) {
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

// Legacy export for backward compatibility
export const authMiddleware = authOptional;
export const generateToken = signJwt;
