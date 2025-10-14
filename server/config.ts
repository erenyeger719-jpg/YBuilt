// server/config.ts
// Central place for required env vars. Crashes early if missing in production.

const NODE_ENV = process.env.NODE_ENV || 'production';

// Use fallback in development only
const DEV_JWT_SECRET = 'dev-secret-change-in-production-min-32-chars-required';

export const JWT_SECRET =
  process.env.JWT_SECRET ||
  (NODE_ENV === 'development' 
    ? DEV_JWT_SECRET
    : (() => {
        throw new Error("JWT_SECRET is missing. Set it in Replit → Tools → Secrets.");
      })());

export const JWT_SECRET_PREVIOUS = process.env.JWT_SECRET_PREVIOUS || undefined;

// Token lifetime; tweak if you want (e.g. "1h", "7d")
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
