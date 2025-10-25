// server/middleware/limits.ts
import type { Request, Response, NextFunction } from "express";

/** Basic rounded window key */
function windowKey(ms: number) {
  return Math.floor(Date.now() / ms);
}

/** Prefer real client IP when behind proxy */
function ipOf(req: Request) {
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  const ip = (xf.split(",")[0] || "").trim();
  return ip || (req.ip || (req.socket && req.socket.remoteAddress) || "unknown");
}

/* ----------------------- Per-minute rate limiting ----------------------- */

type Bucket = { hits: number; resetAt: number };
const rateBuckets = new Map<string, Bucket>();

export function apiRateLimit(opts?: { windowMs?: number; max?: number }) {
  const windowMs = opts?.windowMs ?? 60_000; // 1 min
  const max = opts?.max ?? 120; // 120 req / min / IP

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = ipOf(req);
    const wk = windowKey(windowMs);
    const key = `${ip}:${wk}`;
    const b = rateBuckets.get(key) || { hits: 0, resetAt: (wk + 1) * windowMs };
    b.hits += 1;
    rateBuckets.set(key, b);

    // Friendly headers on both allowed and limited responses
    const remaining = Math.max(0, max - b.hits);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(b.resetAt / 1000)));

    if (b.hits > max) {
      const retryAfterMs = Math.max(0, b.resetAt - Date.now());
      res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({
        ok: false,
        error: "rate_limited",
        message: "Too many requests. Please slow down.",
        retryAfterMs,
      });
    }
    next();
  };
}

/* ----------------------------- Daily quotas ---------------------------- */

type QuotaRule = {
  path: RegExp; // which route(s) to gate
  limit: number; // max per day
  methods?: string[]; // default: any
  keyFn?: (req: Request) => string; // default: per-IP
};

const quotaCounters = new Map<string, number>();

function dayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function quotaGate(rules: QuotaRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const match = rules.find((r) => {
      const m = (r.methods || []).length ? r.methods!.includes(req.method) : true;
      return m && r.path.test(req.path);
    });

    if (!match) return next();

    const id = (match.keyFn ? match.keyFn(req) : ipOf(req)) || "unknown";
    const key = `${dayStamp()}:${match.path}:${id}`;
    const used = quotaCounters.get(key) || 0;

    // Compute reset-at (start of next day, epoch seconds)
    const tomorrowMs = new Date(dayStamp()).getTime() + 24 * 60 * 60 * 1000;
    const resetEpochSeconds = Math.floor(tomorrowMs / 1000);

    if (used >= match.limit) {
      const retryAfterSec = Math.max(0, Math.ceil((tomorrowMs - Date.now()) / 1000));
      res.setHeader("X-Quota-Limit", String(match.limit));
      res.setHeader("X-Quota-Remaining", "0");
      res.setHeader("X-Quota-Reset", String(resetEpochSeconds));
      res.setHeader("Retry-After", String(retryAfterSec));

      return res.status(429).json({
        ok: false,
        error: "quota_exceeded",
        message: "Daily quota exceeded for this operation.",
        limit: match.limit,
        resetAt: new Date(tomorrowMs).toISOString(),
      });
    }

    // Friendly headers for allowed requests too
    const remaining = Math.max(0, match.limit - used - 1); // remaining after this request
    res.setHeader("X-Quota-Limit", String(match.limit));
    res.setHeader("X-Quota-Remaining", String(remaining));
    res.setHeader("X-Quota-Reset", String(resetEpochSeconds));

    quotaCounters.set(key, used + 1);
    next();
  };
}
