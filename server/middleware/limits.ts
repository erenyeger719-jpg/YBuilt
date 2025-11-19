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

type RateBucket = { hits: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

export function apiRateLimit(opts?: { windowMs?: number; max?: number }) {
  const windowMs = opts?.windowMs ?? 60_000; // 1 min
  const max = opts?.max ?? 120; // 120 req / min / IP

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = ipOf(req);
    const wk = windowKey(windowMs);
    const key = `${ip}:${wk}`;
    const existing = rateBuckets.get(key);
    const bucket: RateBucket =
      existing || { hits: 0, resetAt: (wk + 1) * windowMs };

    bucket.hits += 1;
    rateBuckets.set(key, bucket);

    // Friendly headers on both allowed and limited responses
    const remaining = Math.max(0, max - bucket.hits);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));

    if (bucket.hits > max) {
      const retryAfterMs = Math.max(0, bucket.resetAt - Date.now());
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

/* ------------------------ Plans & daily quotas ------------------------- */

type QuotaRule = {
  path: RegExp | string; // which route(s) to gate
  limit: number; // base max per window (free plan)
  methods?: string[]; // default: any
  keyFn?: (req: Request) => string; // default: per-IP
  windowMs?: number; // default: 24h
};

type QuotaBucket = { used: number; resetAt: number };

// In-memory counters: `${ruleIndex}:${plan}:${clientKey}:${windowKey}` -> bucket
const quotaCounters = new Map<string, QuotaBucket>();

// Plan multipliers — "free" is baseline.
const PLAN_MULTIPLIER: Record<string, number> = {
  free: 1,
  creator: 3,
  pro: 10,
};

function getPlanFromReq(req: Request): string {
  try {
    const anyReq = req as any;

    // 1) user.plan if present
    const user = anyReq.user || (anyReq.auth && anyReq.auth.user);
    if (user && typeof user.plan === "string") {
      const p = user.plan.toLowerCase();
      if (PLAN_MULTIPLIER[p]) return p;
    }

    // 2) x-plan header
    const raw = (req.headers["x-plan"] as string) || "";
    if (raw) {
      const p = raw.toLowerCase();
      if (PLAN_MULTIPLIER[p]) return p;
    }
  } catch {
    // fall through
  }

  return "free";
}

function matchQuotaRule(req: Request, rules: QuotaRule[]) {
  const url = (req.originalUrl || req.url || req.path || "") as string;
  const method = (req.method || "GET").toUpperCase();

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;

    const allowedMethods = (rule.methods || []).map((m) =>
      String(m).toUpperCase(),
    );
    const methodOk =
      allowedMethods.length === 0 ? true : allowedMethods.includes(method);

    if (!methodOk) continue;

    let matches = false;
    if (rule.path instanceof RegExp) {
      matches = rule.path.test(url);
    } else {
      matches = url.startsWith(rule.path);
    }

    if (!matches) continue;

    return { rule, index: i };
  }

  return null;
}

export function quotaGate(rules: QuotaRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const match = matchQuotaRule(req, rules);
    if (!match) return next();

    const { rule, index } = match;
    const baseLimit = rule.limit > 0 ? rule.limit : 100;
    const windowMs =
      rule.windowMs && rule.windowMs > 0
        ? rule.windowMs
        : 24 * 60 * 60 * 1000; // default: 1 day

    const plan = getPlanFromReq(req);
    const multiplier = PLAN_MULTIPLIER[plan] || 1;
    const limitForPlan = baseLimit * multiplier;

    const wk = windowKey(windowMs);

    let id: string;
    try {
      id = (rule.keyFn ? rule.keyFn(req) : ipOf(req)) || "unknown";
    } catch {
      id = ipOf(req) || "unknown";
    }

    const clientKey = String(id);
    const bucketKey = `${index}:${plan}:${clientKey}:${wk}`;

    const existing = quotaCounters.get(bucketKey);
    const used = existing ? existing.used : 0;
    const resetAt = existing ? existing.resetAt : (wk + 1) * windowMs;

    // If already over quota, block immediately
    if (used >= limitForPlan) {
      const retryAfterSec = Math.max(
        0,
        Math.ceil((resetAt - Date.now()) / 1000),
      );
      res.setHeader("X-Quota-Limit", String(limitForPlan));
      res.setHeader("X-Quota-Remaining", "0");
      res.setHeader("X-Quota-Reset", String(Math.floor(resetAt / 1000)));
      res.setHeader("Retry-After", String(retryAfterSec));

      return res.status(429).json({
        ok: false,
        error: "quota_exceeded",
        plan,
        limit: limitForPlan,
        windowMs,
      });
    }

    // Allow this one and increment
    const newUsed = used + 1;
    quotaCounters.set(bucketKey, { used: newUsed, resetAt });

    const remaining = Math.max(0, limitForPlan - newUsed);
    res.setHeader("X-Quota-Limit", String(limitForPlan));
    res.setHeader("X-Quota-Remaining", String(remaining));
    res.setHeader("X-Quota-Reset", String(Math.floor(resetAt / 1000)));

    return next();
  };
}
