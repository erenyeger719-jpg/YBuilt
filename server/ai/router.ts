// server/ai/router.ts - Part 1: Core Router & Middleware
import express from "express";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { nanoid } from "nanoid";

// Import route modules
import { setupReviewRoutes } from "./router.review.ts";
import { setupComposeRoutes } from "./router.compose.ts";
import { setupMediaRoutes } from "./router.media.ts";
import { setupMetricsRoutes } from "./router.metrics.ts";

// Import shared utilities and types
import { mountCiteLock } from "./citelock.patch.ts";
import { registerSelfTest } from "./selftest";

// SUP policy core
import { POLICY_VERSION } from "../sup/policy.core.ts";
// Registry for LLM calls
import { chatJSON } from "../llm/registry.ts";
// Middleware imports
import { supGuard } from "../mw/sup.ts";
import { applyDegrade } from "../mw/apply-degrade.ts";
import { sharedCache, makeKeyFromRequest } from "../intent/cache2.ts";
import { aiQuota } from "../middleware/quotas.ts";
import { contractsHardStop } from "../middleware/contracts.ts";

// Import shared helpers that will be exported
import {
  pickModel,
  pickTierByConfidence,
  requireFetch,
  baseUrl,
  childHeaders,
  sha1,
  escapeHtml,
  drainMode,
  cacheMW,
  hasRiskyClaims,
  isProofStrict,
  fetchJSONWithTimeout,
  fetchTextWithTimeout,
  issuesKeyset,
  jaccard,
  segmentSwapSections,
  inferAudience,
  quickGuessIntent,
  stableStringify,
  dslKey,
  applyChipLocal,
  clamp,
  basePxFromTokens,
  buildUxFixCss,
  auditUXFromHtml,
  injectCssIntoHead
} from "./router.helpers.ts";

// Export shared constants and state
export const pathResolve = (...p: string[]) => path.resolve(...p);
export const PREWARM_TOKEN = process.env.PREWARM_TOKEN || "";
export let READY = !PREWARM_TOKEN; // if no token, dev is auto-ready

// Quota configuration
const QUOTA_DAILY = parseInt(process.env.QUOTA_DAILY || "800", 10);
const QUOTA_BURST = parseInt(process.env.QUOTA_BURST || "40", 10);
type Q = { count: number; reset: number; burst: number; _burstTimer?: NodeJS.Timeout };
const quotaState = new Map<string, Q>();

const QUOTA_PATHS = new Set<string>([
  "/instant",
  "/act",
  "/chips/apply",
  "/army",
  "/vectors/search",
]);

// Rate limiting configuration
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS ?? 60_000);
const RATE_MAX = Number(process.env.RATE_MAX ?? 120);
type Bucket = { hits: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Preview directories
export const DEV_PREVIEW_DIR = path.resolve(process.cwd(), "previews/pages");
export const PREVIEW_DIR = path.resolve(process.cwd(), ".cache/previews");

// Shared state
export const LAST_COMPOSE = new Map<string, { key: string; url: string | null }>();
export const LAST_REVIEW_SIG = new Map<string, string>();

// Cache directories setup
const CACHE_DIR = ".cache";
function ensureCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {}
}

// Initialize preview directories
try {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
} catch {}

// Nightly tasks (best-effort)
import { maybeNightlyRetrain } from "../design/outcome.priors.ts";
import { maybeNightlyMine as maybeVectorMine } from "../media/vector.miner.ts";
try {
  maybeNightlyRetrain();
} catch {}
try {
  maybeVectorMine();
} catch {}

// Client key extraction
function clientKey(req: express.Request) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = fwd || (req.ip as string) || "0.0.0.0";
  const sid = String(req.headers["x-session-id"] || (req.query as any).sessionId || "");
  return `${ip}|${sid}`;
}

// Core middleware functions
function quotaMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const p = req.path || "";
    if (!QUOTA_PATHS.has(p)) return next();

    const ip = String(
      (req as any).ip ||
        req.headers["x-forwarded-for"] ||
        (req.socket && req.socket.remoteAddress) ||
        "anon"
    );
    const now = Date.now();
    let q = quotaState.get(ip);
    if (!q || q.reset < now) {
      q = { count: 0, reset: now + 24 * 60 * 60 * 1000, burst: 0 };
      quotaState.set(ip, q);
    }

    q.count++;
    q.burst++;

    const overBurst = q.burst > QUOTA_BURST;
    const overDaily = q.count > QUOTA_DAILY;

    if (!q._burstTimer) {
      q._burstTimer = setTimeout(() => {
        const cur = quotaState.get(ip);
        if (cur) cur.burst = Math.max(0, Math.floor(cur.burst * 0.5));
        if (q && q._burstTimer) {
          try {
            q._burstTimer.unref?.();
          } catch {}
        }
        if (q) q._burstTimer = undefined;
      }, 120_000);
      q._burstTimer.unref?.();
    }

    if (overBurst || overDaily) {
      const retrySec = Math.max(1, Math.floor((q.reset - now) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      res.setHeader("X-RateLimit-Limit", String(QUOTA_DAILY));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, QUOTA_DAILY - q.count)));
      return res.status(429).json({ ok: false, error: "rate_limited", retry_after_s: retrySec });
    }

    res.setHeader("X-RateLimit-Limit", String(QUOTA_DAILY));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, QUOTA_DAILY - q.count)));
    next();
  } catch {
    next();
  }
}

function contractsGuard(req: express.Request, res: express.Response, next: express.NextFunction) {
  const p = req.path || "";
  if (p !== "/act" && p !== "/chips/apply") return next();

  const base = `${req.protocol}://${req.get("host")}`;
  const originalJson = res.json.bind(res);

  (res as any).json = async (body: any) => {
    try {
      if (!body || body.ok === false) {
        return originalJson(body);
      }

      let pid: string | null =
        (body?.result && body.result.pageId) ||
        body?.pageId ||
        null;

      const pullId = (s: string | null | undefined) => {
        if (!s) return null;
        const m = String(s).match(/(?:^|\/)(pg_[A-Za-z0-9_-]+)/);
        return m ? m[1] : null;
      };
      if (!pid) pid = pullId(body?.result?.path);
      if (!pid) pid = pullId(body?.result?.url);
      if (!pid) pid = pullId(body?.path);
      if (!pid) pid = pullId(body?.url);

      if (!pid) {
        return originalJson(body);
      }

      const f = requireFetch();
      const proofResp = await f(`${base}/api/ai/proof/${encodeURIComponent(pid)}`).catch(() => null);
      const proofJson = proofResp ? await proofResp.json().catch(() => null) : null;
      const pObj = (proofJson && (proofJson.proof ?? proofJson)) || null;

      const clsOk = typeof pObj?.cls_est !== "number" || pObj.cls_est <= 0.10;
      const lcpOk = typeof pObj?.lcp_est_ms !== "number" || pObj.lcp_est_ms <= 2500;
      const a11yOk = pObj?.a11y === true;
      const proofOk = pObj?.proof_ok === true;

      res.setHeader("X-Guard-CLS", pObj?.cls_est != null ? String(pObj.cls_est) : "");
      res.setHeader("X-Guard-LCP", pObj?.lcp_est_ms != null ? String(pObj.lcp_est_ms) : "");
      res.setHeader("X-Guard-A11y", String(!!pObj?.a11y));
      res.setHeader("X-Guard-Proof", String(!!pObj?.proof_ok));

      const pass = clsOk && lcpOk && a11yOk && proofOk;

      if (!pass) {
        return originalJson({ ok: false, error: "contracts_failed", proof: pObj });
      }
    } catch {
      return originalJson({ ok: false, error: "contracts_guard_error" });
    }

    return originalJson(body);
  };

  next();
}

// Main router setup
const router = express.Router();
router.use(express.json()); // parse JSON before guarded POSTs

// Apply global middleware
router.use(aiQuota);

// Warmup gate
router.use((req, res, next) => {
  if (READY) return next();
  if (req.path === "/__ready") return next();
  if (PREWARM_TOKEN && req.headers["x-prewarm-token"] === PREWARM_TOKEN) return next();
  return res.status(503).json({ ok: false, error: "warming_up" });
});

// Bypass limiter for special cases
router.use((req, res, next) => {
  const bypass = PREWARM_TOKEN && req.headers["x-prewarm-token"] === PREWARM_TOKEN;
  const isAbuseIntake = req.method === "POST" && req.path === "/abuse/report";
  if (bypass || isAbuseIntake) return next();
  return next();
});

// Apply SUP guard and degradation
router.use(supGuard("ai"));
router.use(applyDegrade());

// Apply quotas and contracts
router.use(quotaMiddleware);
router.use(contractsGuard);

// Basic routes
router.post("/__ready", (req, res) => {
  if (!PREWARM_TOKEN) return res.json({ ok: true, ready: true });
  if (req.headers["x-prewarm-token"] === PREWARM_TOKEN) {
    READY = true;
    return res.json({ ok: true, ready: true });
  }
  return res.status(403).json({ ok: false, error: "forbidden" });
});

router.post("/abuse/report", express.json(), (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(".cache", "abuse");
  fs.mkdirSync(dir, { recursive: true });
  const entry = {
    at: new Date().toISOString(),
    ip: String((req.headers["x-forwarded-for"] as string) || req.ip).split(",")[0].trim(),
    ua: req.headers["user-agent"] || "",
    path: (req.body as any)?.path || req.path,
    reason: (req.body as any)?.reason || "unknown",
    sessionId: (req.body as any)?.sessionId || "",
    notes: (req.body as any)?.notes || "",
  };
  fs.appendFileSync(path.join(dir, `${day}.jsonl`), JSON.stringify(entry) + "\n");
  res.json({ ok: true });
});

// Mount CiteLock shim
mountCiteLock(router);

// Minimal OG/social endpoint
router.get("/og", (req, res) => {
  const { title = "Ybuilt", desc = "OG ready", image = "" } = (req.query as Record<string, string>);
  res.json({ ok: true, title, desc, image });
});

router.post("/outcome", (_req, res) => {
  res.json({ ok: true });
});

// Health pings
router.get("/instant", (req, res) => {
  if ((req.query.goal as string) === "ping") return res.json({ ok: true });
  return res.status(404).json({ ok: false });
});

router.get("/proof/ping", (_req, res) => {
  res.json({ ok: true });
});

// Setup modular routes
setupReviewRoutes(router);
setupComposeRoutes(router);
setupMediaRoutes(router);
setupMetricsRoutes(router);

// Register self-tests
try { registerSelfTest(router); } catch {}

// Export router
export default router;
export { router, ensureCache };