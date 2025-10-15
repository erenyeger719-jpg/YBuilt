// server/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { signJwt as sign, verifyJwt } from "../lib/jwt.js";

export interface JWTPayload {
  sub: number;
  email: string;
}

export function signJwt(payload: JWTPayload): string {
  return sign(payload as unknown as Record<string, unknown>);
}

export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = verifyJwt(token);

    if (typeof decoded !== "object" || decoded == null) {
      throw new Error("Invalid token payload");
    }

    const { sub, email } = decoded as any;
    if (typeof sub !== "number" || typeof email !== "string") {
      throw new Error("Invalid token payload: missing or invalid required fields");
    }

    return { sub, email };
  } catch (error) {
    throw error instanceof Error ? error : new Error("Invalid or expired token");
  }
}

/** Optional auth: attaches req.user if token present, else continues */
export function authOptional(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // "Bearer TOKEN"
    if (!token) {
      req.user = null;
      return next();
    }
    const { sub, email } = verifyToken(token);
    req.user = { id: sub, email };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Required auth: 401 if missing/invalid */
export function authRequired(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { sub, email } = verifyToken(token);
    req.user = { id: sub, email };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Legacy aliases
export const authMiddleware = authOptional;
export const generateToken = signJwt;
