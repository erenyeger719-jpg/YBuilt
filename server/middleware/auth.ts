import { Request, Response, NextFunction } from "express";
import { signJwt as sign, verifyJwt } from "../lib/jwt.js";
import { logger } from "./logging.js";

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
 * Wraps the centralized signJwt from lib/jwt
 */
export function signJwt(payload: JWTPayload): string {
  return sign(payload as unknown as Record<string, unknown>);
}

/**
 * Verify JWT token
 * Wraps the centralized verifyJwt from lib/jwt
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = verifyJwt(token);
    
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
