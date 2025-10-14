import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../index.js";

const JWT_SECRET: string = process.env.JWT_SECRET || "replace_me";
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
  id: number;
  email: string;
}

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

/**
 * Authentication middleware
 * Extracts token from 'Authorization: Bearer <token>' header
 * - If no token, set req.user = null and continue
 * - If token exists, verify using jsonwebtoken and JWT_SECRET
 * - On valid token: attach req.user = { id, email } from JWT payload
 * - On invalid token: return 401 with error message
 */
export function authMiddleware(
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
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (error) {
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

// Legacy types for backward compatibility
export interface LegacyAuthRequest extends Omit<Request, 'user'> {
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

export interface LegacyJWTPayload {
  id: string;
  email: string;
  username: string;
}

/**
 * Legacy authentication middleware (strict)
 * @deprecated Use authMiddleware instead
 * Validates JWT token from Authorization header and attaches user to request
 */
export function authenticateToken(
  req: LegacyAuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: "Access denied. No token provided.",
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as LegacyJWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    logger.error("Token verification failed:", error);
    res.status(403).json({
      error: "Invalid or expired token",
    });
  }
}

/**
 * Legacy optional authentication middleware
 * @deprecated Use authMiddleware instead
 * Attaches user to request if token is valid, but doesn't fail if missing
 */
export function optionalAuth(
  req: LegacyAuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as LegacyJWTPayload;
      req.user = decoded;
    }
  } catch (error) {
    // Token invalid, but we don't fail - just continue without user
    logger.debug("Optional auth failed, continuing without user:", error);
  }
  
  next();
}
