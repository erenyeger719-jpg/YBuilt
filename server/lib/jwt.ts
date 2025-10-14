// server/lib/jwt.ts
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET, JWT_SECRET_PREVIOUS, JWT_EXPIRES_IN } from "../config.js";

export type Payload = Record<string, unknown>;

export function signJwt(payload: Payload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
}

export function verifyJwt(token: string): JwtPayload | string {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (JWT_SECRET_PREVIOUS) return jwt.verify(token, JWT_SECRET_PREVIOUS);
    throw err;
  }
}
