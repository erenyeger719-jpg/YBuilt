// server/middleware/quotas.ts
import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

// Master toggle
const ENABLED = String(process.env.QUOTA_ENABLED || "true").toLowerCase() !== "false";

// Soft caps for free users
const PER_MIN = Math.max(1, parseInt(process.env.QUOTA_PER_MIN || "60", 10));
const PER_DAY = Math.max(1, parseInt(process.env.QUOTA_PER_DAY || "800", 10));
const SOFT_BACKOFF_AT = Math.min(0.99, parseFloat(process.env.QUOTA_BACKOFF_FRAC || "0.9"));
const BACKOFF_MS = Math.max(0, parseInt(process.env.QUOTA_BACKOFF_MS || "200", 10));

// Plan detection (simple + overridable)
const PLAN_HEADER = String(process.env.QUOTA_PLAN_HEADER || "x-plan").toLowerCase();
// comma-separated list; e.g., "free,trial"
const FREE_PLANS = String(process.env.QUOTA_FREE_PLANS || "free,trial")
  .split(",")
  .map((s) => s.trim().toLowerCase());

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;

const minBuckets = new Map<string, Bucket>();
const dayBuckets = new Map<string, Bucket>();

function getBucket(map: Map<string, Bucket>, key: string, windowMs: number): Bucket {
  const now = Date.now();
  const b = map.get(key);
  if (!b || b.resetAt <= now) {
    const nb = { count: 0, resetAt: now + windowMs };
    map.set(key, nb);
    return nb;
  }
  return b;
}

function clientIp(req: Request): string {
  const xf = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim();
  return xf || (req.socket?.remoteAddress || "ip:unknown");
}

function isPaid(req: Request): boolean {
  // 1) Header override: x-plan: pro|team|enterprise (anything not in FREE_PLANS is treated as paid)
  const plan = String(req.headers[PLAN_HEADER] || "").toLowerCase();
  if (plan && !FREE_PLANS.includes(plan)) return true;

  // 2) App-internal user object (optional)
  const userPlan = String((req as any).user?.plan || "").toLowerCase();
  if (userPlan && !FREE_PLANS.includes(userPlan)) return true;

  // 3) API key tier (optional, if you attach it earlier in the stack)
  const tier = String((req as any).apiKeyTier || "").toLowerCase();
  if (tier && !FREE_PLANS.includes(tier)) return true;

  return false;
}

export function aiQuota(req: Request, res: Response, next: NextFunction) {
  if (!ENABLED) return next();          // quotas globally off
  if (isPaid(req)) return next();       // paid users bypass quotas

  const ip = clientIp(req);

  // minute & day windows
  const m = getBucket(minBuckets, ip, MIN_MS);
  const d = getBucket(dayBuckets, ip, DAY_MS);

  // hard stop if over soft caps
  if (m.count >= PER_MIN || d.count >= PER_DAY) {
    const retryMs = Math.max(0, Math.min(m.resetAt - Date.now(), d.resetAt - Date.now()));
    res.setHeader("Retry-After", Math.ceil(retryMs / 1000).toString());
    return res.status(429).json({
      ok: false,
      error: "quota_exceeded",
      meta: { ip, perMin: PER_MIN, perDay: PER_DAY, retryInMs: retryMs },
    });
  }

  // consume
  m.count++;
  d.count++;

  // gentle backoff near cap
  const frac = d.count / PER_DAY;
  if (frac >= SOFT_BACKOFF_AT && BACKOFF_MS > 0) {
    setTimeout(next, BACKOFF_MS);
  } else {
    next();
  }
}
