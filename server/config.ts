// server/config.ts
// Central place for required env vars. Crashes early if missing in production.

// server/config.ts — JWT secret handling
const NODE_ENV = process.env.NODE_ENV || "production";
const inTest = process.env.VITEST_WORKER_ID != null || NODE_ENV === "test";

// You already have this constant above. Use it when not in production.
const DEV_JWT_SECRET = "dev-secret-change-in-production-min-32-chars-required";

export const JWT_SECRET =
  process.env.JWT_SECRET
  ?? process.env.DEV_JWT_SECRET
  ?? (inTest
        ? "test_secret_do_not_use_in_prod"
        : (NODE_ENV !== "production" ? DEV_JWT_SECRET : undefined as any));

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Set JWT_SECRET/DEV_JWT_SECRET (tests/dev have safe fallbacks).");
}

export const JWT_SECRET_PREVIOUS = process.env.JWT_SECRET_PREVIOUS || undefined;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
