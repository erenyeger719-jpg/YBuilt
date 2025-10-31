// server/config.ts
// Central place for required env vars. Crashes early if missing in production.

const NODE_ENV = process.env.NODE_ENV || 'production';

// Use fallback in development only
const DEV_JWT_SECRET = 'dev-secret-change-in-production-min-32-chars-required';

// server/config.ts (JWT secret handling)
const inTest = process.env.VITEST_WORKER_ID != null || process.env.NODE_ENV === "test";

export const JWT_SECRET =
  process.env.JWT_SECRET
  ?? process.env.DEV_JWT_SECRET
  ?? (inTest ? "test_secret_do_not_use_in_prod" : undefined as any);

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Set JWT_SECRET/DEV_JWT_SECRET (tests auto-fallback).");
}

export const JWT_SECRET_PREVIOUS = process.env.JWT_SECRET_PREVIOUS || undefined;

// Token lifetime; tweak if you want (e.g. "1h", "7d")
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
