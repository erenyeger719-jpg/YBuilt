// server/sup/policy.core.ts
// Policy Core v2 — deterministic first, learned second.
// Provides: POLICY_VERSION, computeRiskVector, supDecide, supGuard, signProof

import type { Request, Response, NextFunction } from "express";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { hitSignatures } from "./signatures.ts";
import { countClaimsFromCopy, estimateEvidenceCoverage } from "./claims.ts";
// (Type can be inferred; no need to import ClaimCounts)

// ----- Versioning / Config ---------------------------------------------------

export const POLICY_VERSION = process.env.SUP_POLICY_VERSION || "2.0.0";

// HMAC secret for proof signatures (dev-safe default)
const HMAC_SECRET =
  process.env.SUP_HMAC_KEY ||
  process.env.POLICY_HMAC_SECRET ||
  "dev-only-not-for-production";

// Soft config (can be lifted into a JSON file later)
type GateMode = "off" | "on" | "strict";
type EndpointKey =
  | "/instant"
  | "/instant/dev"
  | "/instant/sticky"
  | "/act/compose"
  | "/act/retrieve"
  | "/review"
  | "default";

const DEFAULT_GATES: Record<EndpointKey, GateMode> = {
  "/instant": "on",
  "/instant/dev": "on",
  "/instant/sticky": "on",
  "/act/compose": "on",
  "/act/retrieve": "on",
  "/review": "on",
  default: "on",
};

// Thresholds (tune by env without redeploy)
const THRESH = {
  // perf
  CLS_MAX: parseFloat(process.env.SUP_MAX_CLS || "0.25"),
  LCP_MS_MAX: parseInt(process.env.SUP_MAX_LCP_MS || "4000", 10),
  // claims
  CLAIMS_BLOCK_STRICT: parseInt(process.env.SUP_CLAIMS_BLOCK_STRICT || "1", 10), // ≥1 critical claim w/o proof
  // a11y
  REQUIRE_A11Y: (process.env.SUP_REQUIRE_A11Y || "0") === "1",
  // pii
  BLOCK_PII_STRICT: (process.env.SUP_BLOCK_PII_STRICT || "1") === "1",
};

// ----- Risk Vector -----------------------------------------------------------

export type RiskVector = {
  prompt_risk: boolean;
  copy_claims: {
    superlative: number;
    percent: number;
    multiplier: number;
    comparative: number;
    factual: number;
    testimonial: number;
    missing_proof: number; // count of claim-bearing fields w/o evidence
    evidence_coverage_pct: number; // 0..100
  };
  device_perf: { cls_est: number | null; lcp_est_ms: number | null };
  a11y: { pass: boolean | null };
  pii: { present: boolean };
  abuse_signals: { sketchy: boolean; reasons: string[] };
  ux?: { score: number | null }; // LQR score (0..100), optional
  // Claim taxonomy + evidence budget
  claim_total?: number;
  claim_kinds?: {
    superlative?: number;
    percent?: number;
    multiplier?: number;
    comparative?: number;
    factual?: number;
    testimonial?: number;
  };
  evidence_coverage?: number; // 0–1, 1 when no claims or fully proven
};

type ComputeArgs = {
  prompt: string;
  copy: Record<string, any>;
  proof?: Record<
    string,
    { status: "evidenced" | "redacted" | "neutral"; [k: string]: any }
  >;
  perf?: { cls_est?: number | null; lcp_est_ms?: number | null } | null;
  ux?: { score?: number; issues?: string[] } | null; // reserved
  a11yPass: boolean | null;
};

const RE = {
  superlative:
    /(?:^|[^a-z0-9])(#[ ]?1|no\.?\s*1|no\s*1|no1|number\s*one|top|best|leading|largest)(?:[^a-z0-9]|$)/i,
  percentSym: /(?:^|[^\d])\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?%(?:\D|$)/,
  percentWord: /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?percent\b/i,
  multiplier: /\b\d+(?:\.\d+)?\s*x(?!\w)/i,
  comparative: /\b(better|faster|cheaper|lighter|stronger|smarter)\b/i,
  // crude PII patterns (good enough for gating; don’t overreach)
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  phone:
    /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/,
  cc:
    /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
};

function countClaims(text: string) {
  let superlative = 0,
    percent = 0,
    multiplier = 0,
    comparative = 0;
  const chunks = text.split(/[\n\r]+/);
  for (const c of chunks) {
    if (RE.superlative.test(c)) superlative++;
    if (RE.percentSym.test(c) || RE.percentWord.test(c)) percent++;
    if (RE.multiplier.test(c)) multiplier++;
    if (RE.comparative.test(c)) comparative++;
  }
  return { superlative, percent, multiplier, comparative };
}

function hasPII(text: string) {
  return RE.email.test(text) || RE.phone.test(text) || RE.cc.test(text);
}

// small content hash helper (for audit trail)
function contentHash(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// map reasons → degrade hints for downstream (UI/runner)
function pickDegrade(reasons: string[]) {
  const s = new Set<string>();

  if (
    reasons.includes("unproven_claims") ||
    reasons.includes("low_evidence_coverage") ||
    reasons.includes("prompt_risk")
  ) {
    s.add("neutralize-claims");
  }

  if (reasons.includes("high_cls") || reasons.includes("slow_lcp")) {
    s.add("no-js");
  }

  if (reasons.includes("lqr_low")) {
    s.add("no-js");
  }

  if (reasons.some((r) => r.startsWith("abuse:"))) {
    s.add("shadow");
  }

  return Array.from(s).join(",");
}

export function computeRiskVector(args: ComputeArgs): RiskVector {
  const promptTxt = String(args.prompt || "");
  const copy = args.copy || {};
  const proof = args.proof || {};
  const allText =
    promptTxt +
    " " +
    Object.values(copy)
      .map((v) => String(v ?? ""))
      .join(" ");

  // 1) Prompt risk
  const prompt_risk =
    RE.superlative.test(promptTxt) ||
    RE.percentSym.test(promptTxt) ||
    RE.percentWord.test(promptTxt) ||
    RE.multiplier.test(promptTxt);

  // 2) Copy claims + evidence
  let superlative = 0,
    percent = 0,
    multiplier = 0,
    comparative = 0,
    factual = 0,
    testimonial = 0,
    missing_proof = 0;

  const CLAIMY_KEYS = new Set([
    "HEADLINE",
    "HERO_SUBHEAD",
    "TAGLINE",
    "FEATURE_1",
    "FEATURE_2",
    "FEATURE_3",
    "CTA_HEAD",
  ]);

  for (const [k, v] of Object.entries(copy)) {
    const val = String(v ?? "");
    const c = countClaims(val);
    superlative += c.superlative;
    percent += c.percent;
    multiplier += c.multiplier;
    comparative += c.comparative;

    // naive bins
    if (/\b(according to|study|report|data|benchmark|research)\b/i.test(val))
      factual++;
    if (/\b(customer|client|user)\b.*\b(said|says|review|testimonial)\b/i.test(val))
      testimonial++;

    if (CLAIMY_KEYS.has(k)) {
      const p = (proof as any)[k];
      const ok = p && p.status === "evidenced";
      if (!ok && (c.superlative || c.percent || c.multiplier || c.comparative)) {
        missing_proof++;
      }
    }
  }

  const proven =
    Object.values(proof).filter((p: any) => p?.status === "evidenced").length ||
    0;
  const total = Object.keys(proof || {}).length || 0;
  const evidence_coverage_pct = total ? Math.round((proven / total) * 100) : 0;

  // 3) Perf & a11y
  const cls_est =
    args?.perf && typeof args.perf.cls_est === "number"
      ? (args.perf.cls_est as number)
      : null;
  const lcp_est_ms =
    args?.perf && typeof args.perf.lcp_est_ms === "number"
      ? (args.perf.lcp_est_ms as number)
      : null;

  // 4) PII
  const pii = { present: hasPII(allText) };

  // 5) Abuse signals (cheap heuristics)
  const abuseReasons: string[] = [];
  if (/(free\s*money|guaranteed\s*profit|pump\s*and\s*dump)/i.test(allText))
    abuseReasons.push("scam_lang");
  if (/(deepfake|impersonate|bypass|jailbreak)/i.test(allText))
    abuseReasons.push("abuse_terms");
  const abuse_signals = { sketchy: abuseReasons.length > 0, reasons: abuseReasons };

  const risk: RiskVector = {
    prompt_risk,
    copy_claims: {
      superlative,
      percent,
      multiplier,
      comparative,
      factual,
      testimonial,
      missing_proof,
      evidence_coverage_pct,
    },
    device_perf: { cls_est, lcp_est_ms },
    a11y: { pass: args.a11yPass },
    pii,
    abuse_signals,
    ux: { score: args.ux?.score ?? null },
  };

  // ---- Claim taxonomy + evidence budget ----
  const copyObj = args.copy || {};
  const proofObj = args.proof || {};

  const claimCounts = countClaimsFromCopy(copyObj);
  const evidenceCoverage = estimateEvidenceCoverage(proofObj, claimCounts.total);

  risk.claim_total = claimCounts.total;
  risk.claim_kinds = {
    superlative: claimCounts.byKind.superlative || 0,
    percent: claimCounts.byKind.percent || 0,
    multiplier: claimCounts.byKind.multiplier || 0,
    comparative: claimCounts.byKind.comparative || 0,
    factual: claimCounts.byKind.factual || 0,
    testimonial: claimCounts.byKind.testimonial || 0,
  };
  risk.evidence_coverage = evidenceCoverage;

  return risk;
}

// ----- Decision Engine -------------------------------------------------------

export function supDecide(
  endpoint: EndpointKey | string,
  risk: RiskVector
): { mode: "allow" | "strict" | "block"; reasons: string[] } {
  const gate =
    (DEFAULT_GATES as any)[endpoint as EndpointKey] ??
    (DEFAULT_GATES as any).default;

  if (gate === "off") return { mode: "allow", reasons: ["gate_off"] };

  const reasons: string[] = [];

  // Perf
  if (
    risk.device_perf.cls_est != null &&
    risk.device_perf.cls_est > THRESH.CLS_MAX
  )
    reasons.push("high_cls");
  if (
    risk.device_perf.lcp_est_ms != null &&
    risk.device_perf.lcp_est_ms > THRESH.LCP_MS_MAX
  )
    reasons.push("slow_lcp");

  // Claims
  if (risk.copy_claims.missing_proof >= THRESH.CLAIMS_BLOCK_STRICT)
    reasons.push("unproven_claims");

  // New: evidence coverage based guard
  const coverage =
    typeof risk.evidence_coverage === "number"
      ? risk.evidence_coverage
      : null;

  if (
    coverage !== null &&
    (risk.claim_total || 0) > 0 &&
    coverage < 0.5
  ) {
    reasons.push("low_evidence_coverage");
  }

  // A11y
  if (THRESH.REQUIRE_A11Y && risk.a11y.pass === false)
    reasons.push("a11y_fail");

  // UX (LQR)
  if ((risk.ux?.score ?? null) != null && (risk.ux!.score as number) < 70) {
    reasons.push("lqr_low");
  }

  // Prompt risk
  if (risk.prompt_risk) reasons.push("prompt_risk");

  // PII
  if (THRESH.BLOCK_PII_STRICT && risk.pii.present) reasons.push("pii_present");

  // Abuse
  if (risk.abuse_signals.sketchy) {
    for (const r of risk.abuse_signals.reasons) reasons.push(`abuse:${r}`);
  }

  // Decide mode
  if (gate === "strict") {
    if (reasons.length) return { mode: "block", reasons };
    return { mode: "strict", reasons: [] };
  }

  // Gate = "on"
  if (reasons.includes("abuse:scam_lang") || reasons.includes("pii_present")) {
    return { mode: "block", reasons };
  }
  if (reasons.some((r) => r.startsWith("abuse:"))) {
    return { mode: "strict", reasons };
  }
  if (
    reasons.includes("unproven_claims") ||
    reasons.includes("low_evidence_coverage") ||
    reasons.includes("prompt_risk")
  ) {
    return { mode: "strict", reasons };
  }
  if (reasons.includes("high_cls") || reasons.includes("slow_lcp")) {
    return { mode: "strict", reasons };
  }
  // Note: lqr_low currently degrades via pickDegrade when strict is entered for any reason.

  return { mode: "allow", reasons: [] };
}

// ----- Signed Proof ----------------------------------------------------------

export function signProof(payload: {
  pageId: string;
  policy_version: string;
  risk: RiskVector | Record<string, any>;
}): string {
  const msg = JSON.stringify({
    pageId: payload.pageId,
    policy_version: payload.policy_version,
    risk: payload.risk,
  });
  return crypto.createHmac("sha256", HMAC_SECRET).update(msg).digest("hex");
}

// ----- SUP Guard (Quotas + Basic Abuse) -------------------------------------

type LedgerRec = { hits: number; windowStart: number; score: number };
const ledger = new Map<string, LedgerRec>();
let _pruneTick = 0;

const QUOTA = {
  WINDOW_MS: parseInt(process.env.SUP_WINDOW_MS || "60000", 10), // 60s
  MAX_BURST: parseInt(process.env.SUP_MAX_RPM || "120", 10), // requests per window
  DECAY_MS: parseInt(process.env.SUP_DECAY_MS || "300000", 10), // 5m decay of "score"
  BYPASS_TEST: true,
};

function workspaceIdFromReq(req: Request): string {
  const raw = req.headers["x-workspace-id"];
  if (!raw) return "";
  if (Array.isArray(raw)) {
    return (raw[0] || "").toString().trim();
  }
  return raw.toString().trim();
}

function keyFrom(req: Request) {
  const fwd = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const ip = fwd || (req.ip as string) || "0.0.0.0";
  const sid =
    String(req.headers["x-session-id"] || (req.query as any)?.sessionId || "") ||
    "";
  const api = String(req.headers["x-api-key"] || "");
  const ws = workspaceIdFromReq(req);
  return `${ip}|${sid}|${api}|${ws}`;
}

export function supGuard() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Match /api/abuse/report (not just raw path)
    const p = String(req.originalUrl || req.path || "");
    const isAbuseIntake = req.method === "POST" && /\/abuse\/report$/i.test(p);

    // Bypass: tests, prewarm, abuse intake
    if (
      (QUOTA.BYPASS_TEST &&
        String(req.headers["x-test"] || "").toLowerCase() === "1") ||
      (process.env.PREWARM_TOKEN &&
        req.headers["x-prewarm-token"] === process.env.PREWARM_TOKEN) ||
      isAbuseIntake
    ) {
      res.setHeader("X-SUP-Mode", "allow");
      res.setHeader("X-SUP-Policy-Version", POLICY_VERSION);
      return next();
    }

    // ------- Quota bucket (IP|session|api-key|workspace)
    const k = keyFrom(req);
    const now = Date.now();
    const workspaceId = workspaceIdFromReq(req);
    res.setHeader("X-SUP-Workspace", workspaceId || "");

    const rec = ledger.get(k) || { hits: 0, windowStart: now, score: 0 };

    const elapsed = now - rec.windowStart;
    if (elapsed >= QUOTA.WINDOW_MS) {
      // decay score based on elapsed BEFORE resetting window
      if (elapsed >= QUOTA.DECAY_MS) {
        rec.score = 0;
      } else {
        const decay = elapsed / QUOTA.DECAY_MS; // 0..1
        rec.score = Math.max(0, rec.score - decay);
      }
      rec.hits = 0;
      rec.windowStart = now;
    }

    rec.hits += 1;

    // Light heuristics
    if (/curl|python-requests|wget/i.test(String(req.headers["user-agent"] || "")))
      rec.score += 0.1;
    if (rec.hits > QUOTA.MAX_BURST) rec.score += 1;

    ledger.set(k, rec);

    // periodic prune to cap memory
    if (++_pruneTick % 1000 === 0) {
      const nowMs = Date.now();
      for (const [key, val] of ledger) {
        if (nowMs - val.windowStart > QUOTA.DECAY_MS * 6) ledger.delete(key);
      }
    }

    const remaining = Math.max(0, QUOTA.MAX_BURST - rec.hits);
    res.setHeader("X-SUP-Quota-Remaining", String(remaining));
    res.setHeader("X-SUP-Policy-Version", POLICY_VERSION);

    if (rec.hits > QUOTA.MAX_BURST) {
      // How long until this quota window resets (in seconds)
      const retryMs = rec.windowStart + QUOTA.WINDOW_MS - now;
      const retrySec = Math.max(1, Math.ceil(retryMs / 1000));

      res.setHeader("Retry-After", String(retrySec));
      res.setHeader("X-SUP-Mode", "block");

      return res.status(429).json({ ok: false, error: "rate_limited" });
    }

    // ------- Compute risk + decision + audit (hardened)
    try {
      const body: any = req.body || {};
      const prompt = String(body.prompt || body.user || "");
      const copy =
        body && body.copy && typeof body.copy === "object" ? body.copy : {};

      // Optional proof object from client (CiteLock / evidence map)
      const proof =
        body && body.proof && typeof body.proof === "object" ? body.proof : {};

      // Accept optional UX/perf/a11y from the request
      const perf =
        body && typeof body.perf === "object"
          ? {
              cls_est:
                typeof body.perf.cls_est === "number"
                  ? body.perf.cls_est
                  : null,
              lcp_est_ms:
                typeof body.perf.lcp_est_ms === "number"
                  ? body.perf.lcp_est_ms
                  : null,
            }
          : null;

      const ux =
        body && typeof body.ux === "object"
          ? {
              score:
                typeof body.ux.score === "number" ? body.ux.score : null,
              issues: Array.isArray(body.ux.issues)
                ? body.ux.issues.slice(0, 20)
                : [],
            }
          : null;

      const a11yPass =
        typeof body.a11yPass === "boolean" ? body.a11yPass : null;

      const risk = computeRiskVector({
        prompt,
        copy,
        proof,
        perf,
        ux,
        a11yPass,
      });

      // --- quick heuristics that raise score ---
      const ua = String(req.headers["user-agent"] || "");
      const headlessHit =
        /(headless|puppeteer|playwright|phantomjs|selenium)/i.test(ua);
      if (headlessHit) rec.score += 0.5;

      // micro-burst inside current window
      if (rec.hits > Math.min(QUOTA.MAX_BURST * 0.5, 30)) rec.score += 0.5;

      // --- Honey + signature matches (Abuse Mesh v0.5) ---
      const matchText = `${prompt} ${Object.values(copy)
        .map((v) => String(v ?? ""))
        .join(" ")}`;
      const sigHits = hitSignatures(matchText);
      if (sigHits.length) {
        risk.abuse_signals.sketchy = true;
        for (const r of sigHits) {
          if (!risk.abuse_signals.reasons.includes(r)) {
            risk.abuse_signals.reasons.push(r); // e.g. "honey:..." or "sig:..."
          }
        }
        // tiny score bump to ensure strict/shadow kicks in consistently
        const rec2 =
          ledger.get(k) || { hits: 0, windowStart: Date.now(), score: 0 };
        rec2.score += 0.5;
        ledger.set(k, rec2);
        rec.score = rec2.score; // keep local ref in sync
      }

      // fold into risk BEFORE decision so it goes to strict
      const extraReasons: string[] = [];
      if (rec.score >= 1) extraReasons.push("abuse:velocity");
      if (headlessHit) extraReasons.push("abuse:ua_entropy");
      if (extraReasons.length) {
        risk.abuse_signals.sketchy = true;
        for (const r of extraReasons) {
          if (!risk.abuse_signals.reasons.includes(r))
            risk.abuse_signals.reasons.push(r);
        }
      }

      const decision = supDecide((req.path as any) || "default", risk);

      res.setHeader("X-SUP-Mode", decision.mode);
      res.setHeader("X-SUP-Reasons", decision.reasons.join(","));
      // Echo perf/UX metrics for observability
      if (risk.device_perf.cls_est != null)
        res.setHeader("X-Perf-CLS", String(risk.device_perf.cls_est));
      if (risk.device_perf.lcp_est_ms != null)
        res.setHeader("X-Perf-LCP", String(risk.device_perf.lcp_est_ms));
      if (typeof (risk as any).ux?.score === "number")
        res.setHeader("X-UX-LQR", String((risk as any).ux.score));

      // ---- Proof header (attestation)
      const pageId =
        String(
          (req.headers["x-page-id"] as string) ||
            (req.body?.pageId as string) ||
            ""
        ) || "anon";
      const proofSig = signProof({
        pageId,
        policy_version: POLICY_VERSION,
        risk,
      });
      res.setHeader("X-SUP-Proof-Sig", proofSig);

      if (decision.mode === "block") {
        return res
          .status(403)
          .json({ ok: false, error: "sup_block", reasons: decision.reasons });
      }
      if (decision.mode === "strict") {
        // downstream can degrade behavior (retrieval-only, neutral tone, no-JS)
        (req.headers as any)["x-drain"] = "1";
        res.setHeader("X-Drain", "1");
        const degrade = pickDegrade(decision.reasons);
        if (degrade) res.setHeader("X-Degrade", degrade);
        // If strict due to abuse, advertise a POW challenge (no UI dependency)
        if (decision.reasons.some((r) => r.startsWith("abuse:"))) {
          res.setHeader("X-Challenge", "pow-v0");
        }
        (res.locals as any).sup = {
          mode: "strict",
          reasons: decision.reasons,
          degrade,
        };
      }

      // ---- Tamper-evident audit trail (JSONL)
      const started = Date.now();
      const reqHash = contentHash(
        String((req.body?.prompt as string) || "") +
          JSON.stringify((req.body?.copy as any) || {})
      );

      res.on("finish", () => {
        try {
          const outHash = String(res.getHeader("X-Content-Hash") || "");
          const row = {
            ts: new Date().toISOString(),
            endpoint: req.path,
            pageId,
            policy_version: POLICY_VERSION,
            mode: decision.mode,
            reasons: decision.reasons,
            status: res.statusCode,
            ms: Date.now() - started,
            req_hash: reqHash,
            res_hash: outHash || undefined,
            workspace_id: workspaceIdFromReq(req),
            // risk snapshot
            perf: risk.device_perf,
            ux_lqr: (risk as any).ux?.score ?? null,
          };
          fs.mkdirSync(".logs/sup", { recursive: true });
          fs.appendFile(
            ".logs/sup/audit.jsonl",
            JSON.stringify(row) + "\n",
            () => {},
          );
        } catch {
          /* no-op */
        }
      });
    } catch {
      // Fail-closed: strict + drain + shadow, but no crash
      res.setHeader("X-SUP-Mode", "strict");
      res.setHeader("X-SUP-Reasons", "sup_internal_error");
      (req.headers as any)["x-drain"] = "1";
      res.setHeader("X-Drain", "1");
      res.setHeader("X-Degrade", "shadow");
      (res.locals as any).sup = {
        mode: "strict",
        reasons: ["sup_internal_error"],
        degrade: "shadow",
      };
    }

    return next();
  };
}
