// server/lib/jwt.ts
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { JWT_SECRET, JWT_SECRET_PREVIOUS, JWT_EXPIRES_IN } from "../config.js";

type Payload = Record<string, unknown>;

export function signJwt(payload: Payload): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: JWT_EXPIRES_IN as string | number,
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
