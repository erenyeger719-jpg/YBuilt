// server/ai/router.helpers.ts - Shared helper functions
import crypto from "crypto";
import { Request } from "express";

// Model selection helpers
export function pickModel(task: "planner" | "coder" | "critic", tier = "balanced") {
  const map = {
    fast: {
      planner: { provider: "openai", model: "gpt-4o-mini" },
      coder: { provider: "openai", model: "gpt-4o-mini" },
      critic: { provider: "openai", model: "gpt-4o-mini" },
    },
    balanced: {
      planner: { provider: "openai", model: "gpt-4o-mini" },
      coder: { provider: "openai", model: "gpt-4o" },
      critic: { provider: "openai", model: "gpt-4o-mini" },
    },
    best: {
      planner: { provider: "openai", model: "gpt-4o" },
      coder: { provider: "openai", model: "gpt-4o" },
      critic: { provider: "openai", model: "gpt-4o" },
    },
  } as const;
  const tierMap = (map as any)[tier] || (map as any).balanced;
  return tierMap[task] || tierMap.coder;
}

export function pickTierByConfidence(c = 0.6) {
  if (c >= 0.8) return "fast";
  if (c >= 0.6) return "balanced";
  return "best";
}

// Network helpers
export function requireFetch(): (input: any, init?: any) => Promise<any> {
  const f = (globalThis as any).fetch;
  if (typeof f !== "function") {
    throw new Error("fetch_unavailable: Node 18+ (or a fetch polyfill) is required.");
  }
  return f as any;
}

export async function fetchJSONWithTimeout(url: string, opts?: any, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const f = requireFetch();
    const r = await f(url, { ...(opts || {}), signal: ctrl.signal });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || `HTTP_${(r as any).status}`);
    return JSON.parse(txt);
  } finally {
    clearTimeout(id);
  }
}

export async function fetchTextWithTimeout(url: string, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const f = requireFetch();
    const r = await f(url, { signal: ctrl.signal });
    return await r.text();
  } finally {
    clearTimeout(id);
  }
}

// URL and request helpers
export function baseUrl(req: Request) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

export function childHeaders(req: Request) {
  const h: Record<string, string> = {
    "content-type": "application/json",
    "accept-language": String(req.headers["accept-language"] || ""),
  };
  const test = String(req.headers["x-test"] || "").toLowerCase();
  if (test === "1") h["x-test"] = "1";
  const aud = String(req.headers["x-audience"] || "");
  if (aud) h["x-audience"] = aud;
  const proofStrict = String(req.headers["x-proof-strict"] || "").toLowerCase();
  if (proofStrict === "1") h["x-proof-strict"] = "1";
  const deviceGate = String(req.headers["x-device-gate"] || "").toLowerCase();
  if (deviceGate) h["x-device-gate"] = deviceGate;
  return h;
}

// Crypto helpers
export function sha1(s: string) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

export function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Execution / drain helpers

export type DrainLevel = "off" | "soft" | "hard";

export function currentDrainLevel(req?: Request): DrainLevel {
  // 1) Try header override first
  let raw: string | undefined;

  try {
    raw =
      (req as any)?.headers?.["x-drain-mode"] ||
      (req as any)?.headers?.["X-Drain-Mode"];
  } catch {
    // ignore
  }

  // 2) Fallback to env
  if (!raw || typeof raw !== "string") {
    raw = process.env.DRAIN_MODE || "off";
  }

  let v = raw.toString().trim().toLowerCase();

  // 3) Normalize some shortcuts
  if (v === "1" || v === "true" || v === "on") v = "hard";
  if (v !== "off" && v !== "soft" && v !== "hard") v = "off";

  return v as DrainLevel;
}

// Keep the name drainMode so all existing imports still work
export function drainMode(req?: Request): boolean {
  return currentDrainLevel(req) !== "off";
}

// Execution tier helpers

export type ExecTier = "safe-html" | "light-js" | "full";

export function currentExecTier(req?: Request): ExecTier {
  let raw: string | undefined;

  try {
    raw =
      (req as any)?.headers?.["x-exec-tier"] ||
      (req as any)?.headers?.["X-Exec-Tier"];
  } catch {
    // ignore
  }

  if (!raw || typeof raw !== "string") {
    raw = process.env.EXEC_TIER_DEFAULT || "full";
  }

  const v = raw.toString().trim().toLowerCase();

  if (v === "safe-html" || v === "safe" || v === "html") return "safe-html";
  if (v === "light-js" || v === "light" || v === "lite") return "light-js";
  return "full";
}

// Make strict-mode decision from env and (optionally) request headers
export function isProofStrict(req?: { headers?: any }): boolean {
  // Env always wins
  const env = (process.env.PROOF_STRICT || "").toString().trim();
  if (env === "1" || env.toLowerCase() === "true" || env.toLowerCase() === "strict") {
    return true;
  }
  if (env === "0") {
    return false;
  }

  // Then headers, if we got a req
  const headers = (req as any)?.headers || {};
  const raw =
    headers["x-proof-strict"] ??
    headers["x-proof-mode"] ??
    headers["x-proof"] ??
    "";

  if (!raw) return false;

  const v = Array.isArray(raw) ? raw[0] : raw;
  const s = String(v).toLowerCase().trim();

  return s === "1" || s === "true" || s === "strict";
}

// Caching middleware helper
export function cacheMW(intent: string) {
  return (req: any, res: any, next: any) => {
    const { makeKeyFromRequest, sharedCache } = require("../intent/cache2.ts");
    const key = makeKeyFromRequest(req.path, req.body, { intent });
    const mode = String(res.getHeader?.("X-SUP-Mode") || req.headers["x-sup-mode"] || "");
    const reasons = String(res.getHeader?.("X-SUP-Reasons") || req.headers["x-sup-reasons"] || "");
    const bypass = mode === "strict" && /(?:^|,)abuse:/.test(reasons);

    if (!bypass) {
      const hit = sharedCache.get(key);
      if (hit != null) {
        res.setHeader("X-Cache", "hit");
        res.setHeader("X-Cache-Key", key);
        return res.json(hit);
      }
    }

    const origJson = res.json.bind(res);
    (res as any).json = (body: any) => {
      if (!bypass) {
        sharedCache.set(key, body);
        res.setHeader("X-Cache", "miss");
        res.setHeader("X-Cache-Key", key);
      }
      return origJson(body);
    };
    next();
  };
}

// Risk detection
export function hasRiskyClaims(s: string) {
  const p = String(s || "");
  const superlative =
    /(?:^|[^a-z0-9])(#[ ]?1|no\.?\s*1|no\s*1|no1|number\s*one|top|best|leading|largest)(?:[^a-z0-9]|$)/i;
  const percentSymbol = /(?:^|[^\d])\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?%(?:\D|$)/;
  const percentWord = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?percent\b/i;
  const multiplier = /\b\d+(?:\.\d+)?\s*x(?!\w)/i;

  return (
    superlative.test(p) ||
    percentSymbol.test(p) ||
    percentWord.test(p) ||
    multiplier.test(p)
  );
}

// Review helpers
export function issuesKeyset(issues: any[] = []) {
  return new Set(
    issues.map((i) =>
      `${String(i.type || "")}|${i?.ops?.[0]?.file || ""}|${i?.ops?.[0]?.find || ""}`.slice(0, 200)
    )
  );
}

export function jaccard(aSet: Set<string> | any, bSet: Set<string> | any) {
  const a = new Set(aSet as any), b = new Set(bSet as any);
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  const union = a.size + b.size - inter || 1;
  return inter / union;
}

// Personalization
export function segmentSwapSections(ids: string[] = [], audience = "all") {
  const a = String(audience || "").toLowerCase().trim();
  const set = new Set((ids || []).map(String));

  const isDev = a === "developers" || a === "developer" || a === "dev" || a === "devs";
  const isFounder = a === "founders" || a === "founder";
  const isShopper = a === "shoppers" || a === "shopper";

  if (isDev || isShopper) set.add("features-3col");
  if (isFounder) set.add("pricing-simple");
  if (isDev) set.delete("pricing-simple");

  const base = (ids || []).map(String);
  const extras: string[] = [];
  for (const k of ["features-3col", "pricing-simple"]) {
    if (!base.includes(k) && set.has(k)) extras.push(k);
  }
  return base.concat(extras);
}

export function inferAudience(spec: any): string {
  const direct = String(spec?.audience || spec?.intent?.audience || "").toLowerCase().trim();
  if (direct) return direct;

  const text =
    String(spec?.summary || spec?.lastSpec?.summary || "") +
    " " +
    Object.values(spec?.copy || {}).join(" ");

  const p = text.toLowerCase();

  const devHit =
    /\bdev(eloper|elopers|s)?\b/.test(p) ||
    /\bengineer(s)?\b/.test(p) ||
    /\bcoder(s)?\b/.test(p) ||
    /\bprogrammer(s)?\b/.test(p);

  const founderHit =
    /\bfounder(s)?\b/.test(p) ||
    /\bstartup\b/.test(p) ||
    /\b(startup|founder)\s*(ceo|cto|team)?\b/.test(p) ||
    (/\bpricing\b/.test(p) && (/\bstartup\b|\bfounder(s)?\b/.test(p))) ||
    /\binvest(or|ors|ment)\b/.test(p);

  const shopperHit =
    /\bshopper(s)?\b/.test(p) || /\bconsumer(s)?\b/.test(p) || /\be-?commerce\b/.test(p);

  if (devHit) return "developers";
  if (founderHit) return "founders";
  if (shopperHit) return "shoppers";
  return "all";
}

export function quickGuessIntent(prompt: string) {
  const p = String(prompt || "").toLowerCase();

  const isDev =
    /\bdev(eloper|elopers|s)?\b/.test(p) ||
    /\bengineer(s)?\b/.test(p) ||
    /\bcoder(s)?\b/.test(p) ||
    /\bprogrammer(s)?\b/.test(p);

  const isFounder = /\bfounder(s)?\b/.test(p) || /\bstartup\s*(ceo|cto|team)\b/.test(p);
  const isShopper = /\bshopper(s)?\b/.test(p) || /\bconsumer(s)?\b/.test(p);

  const intent = {
    audience: isDev ? "developers" : isFounder ? "founders" : isShopper ? "shoppers" : "",
    goal: /\bwaitlist\b/.test(p)
      ? "waitlist"
      : /\bdemo\b/.test(p)
      ? "demo"
      : /\b(buy|purchase)\b/.test(p)
      ? "purchase"
      : /\bcontact\b/.test(p)
      ? "contact"
      : "",
    industry: /\bsaas\b/.test(p)
      ? "saas"
      : /\becomm(erce)?\b/.test(p)
      ? "ecommerce"
      : /\bportfolio\b/.test(p)
      ? "portfolio"
      : "",
    vibe: /\bminimal\b/.test(p)
      ? "minimal"
      : /\bbold\b/.test(p)
      ? "bold"
      : /\bplayful\b/.test(p)
      ? "playful"
      : /\bserious\b/.test(p)
      ? "serious"
      : "",
    color_scheme: /\bdark\b/.test(p) ? "dark" : /\blight\b/.test(p) ? "light" : "",
    density: /\bminimal\b/.test(p) ? "minimal" : "",
    complexity: /\bsimple\b/.test(p) ? "simple" : "",
    sections: ["hero-basic", "cta-simple"].concat(/\bfeature(s)?\b/.test(p) ? ["features-3col"] : []),
  };

  const filled = Object.values({ ...intent, sections: null as any }).filter(Boolean).length;
  const coverage = filled / 7;
  
  const { clarifyChips } = require("../intent/clarify.ts");
  const chips = [
    intent.color_scheme !== "light" ? "Switch to light" : "Use dark mode",
    /\bminimal\b/.test(p) ? "More playful" : "More minimal",
    intent.goal === "waitlist" ? "Use email signup CTA" : "Use waitlist",
  ];

  return coverage >= 0.5 ? ({ intent, confidence: 0.7, chips } as any) : null;
}

// DSL helpers
export function stableStringify(o: any): string {
  if (Array.isArray(o)) return "[" + o.map(stableStringify).join(",") + "]";
  if (o && typeof o === "object") {
    return (
      "{" +
      Object.keys(o)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stableStringify(o[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(o);
}

export function dslKey(payload: any) {
  return sha1(stableStringify(payload));
}

// Apply chip locally
export function applyChipLocal(spec: any = {}, chip = "") {
  const s = { ...spec, brand: { ...(spec.brand || {}) } };

  if (/Switch to light/i.test(chip)) s.brand.dark = false;
  if (/Use dark mode/i.test(chip)) s.brand.dark = true;
  if (/More minimal/i.test(chip) || /Keep it minimal/i.test(chip)) s.brand.tone = "minimal";
  if (/More playful/i.test(chip)) s.brand.tone = "playful";
  if (/Use premium style/i.test(chip)) s.brand.tier = "premium";
  if (/Use minimal style/i.test(chip)) s.brand.tier = "minimal";
  if (/Use playful style/i.test(chip)) s.brand.tier = "playful";
  if (/Use brutalist style/i.test(chip)) s.brand.tier = "brutalist";

  if (/Add 3-card features/i.test(chip)) {
    const cur = new Set((s.layout?.sections || []).map(String));
    cur.add("features-3col");
    s.layout = { sections: Array.from(cur) };
  }
  if (/Use 2-column features/i.test(chip)) {
    s.layout = { sections: (s.layout?.sections || []).filter((id: string) => id !== "features-3col") };
  }

  if (/Use email signup CTA/i.test(chip)) {
    s.copy = { ...(s.copy || {}), CTA_LABEL: "Get started", CTA_HEAD: "Ready when you are" };
  }
  if (/Use waitlist/i.test(chip)) {
    s.copy = { ...(s.copy || {}), CTA_LABEL: "Join the waitlist", CTA_HEAD: "Be first in line" };
  }
  return s;
}

// UX helpers
export function clamp(n: number, a: number, b: number) {
  return Math.min(Math.max(n, a), b);
}

export function basePxFromTokens(tokens: any): number {
  try {
    const px = Number(tokens?.type?.basePx || NaN);
    if (!Number.isNaN(px) && px > 0) return px;
    const vars = String(tokens?.cssVars || "");
    const m = vars.match(/--type-[a-z-]*base[a-z-]*:\s*([0-9]+)px/i);
    if (m && Number(m[1]) > 0) return Number(m[1]);
  } catch {}
  return 18;
}

export function buildUxFixCss(basePx = 18): string {
  const s1 = Math.round(basePx * 0.5);
  const s2 = Math.round(basePx * 0.75);
  const s3 = Math.round(basePx * 1.0);
  const s4 = Math.round(basePx * 1.5);
  const s6 = Math.round(basePx * 2.0);

  return `
/* === UX Designer Auto-Fix (spacing/rhythm) === */
:root{
  --ux-container-ch:72;
  --ux-space-1:${s1}px;
  --ux-space-2:${s2}px;
  --ux-space-3:${s3}px;
  --ux-space-4:${s4}px;
  --ux-space-6:${s6}px;
}
main,section,article{
  max-width:calc(var(--ux-container-ch)*1ch);
  margin-left:auto;margin-right:auto;
  padding-left:clamp(12px,4vw,24px);
  padding-right:clamp(12px,4vw,24px);
}
h1{margin-top:0;margin-bottom:var(--ux-space-3);}
h2,h3{margin-top:var(--ux-space-3);margin-bottom:var(--ux-space-2);}
p,ul,ol,pre,blockquote{margin-top:var(--ux-space-2);margin-bottom:var(--ux-space-3);}
section + section, article + article{margin-top:var(--ux-space-6);}
img,video,figure{display:block;max-width:100%;height:auto;margin:var(--ux-space-3) 0;}
button,.btn,.cta{margin-top:var(--ux-space-2);}
hr{border:none;height:1px;background-color:rgba(0,0,0,.08);margin:var(--ux-space-4) 0;}
/* === end UX auto-fix === */
`.trim();
}

export type UXAudit = {
  score: number;
  issues: string[];
  pass: boolean;
  cssFix?: string | null;
};

export function auditUXFromHtml(html: string, tokens?: any): UXAudit {
  const issues: string[] = [];
  const src = String(html || "");
  const lower = src.toLowerCase();

  const hasMaxWidth = /max-width\s*:\s*\d+(px|rem|ch)/i.test(src);
  const hasContainerClass = /\b(container|wrapper|content|prose)\b/.test(lower);
  if (!hasMaxWidth && !hasContainerClass) issues.push("no_max_width");

  const tightPairs =
    (src.match(/<\/(h1|h2|h3|p|ul|ol|section|article)>\s*<(h1|h2|h3|p|ul|ol|section|article)/gi) || [])
      .length;
  if (tightPairs >= 6) issues.push("tight_stacks");
  else if (tightPairs >= 3) issues.push("slightly_tight");

  const longParas =
    (lower.match(/<p>[^<]{220,}<\/p>/gi) || []).length +
    (lower.match(/<li>[^<]{180,}<\/li>/gi) || []).length;
  if (longParas >= 4) issues.push("long_blocks");
  else if (longParas >= 1) issues.push("some_long_blocks");

  const headlineRush = (src.match(/<\/h1>\s*<(h1|h2)\b/gi) || []).length;
  if (headlineRush >= 2) issues.push("headline_rush");

  let score = 92;
  const penalties: Record<string, number> = {
    no_max_width: 18,
    tight_stacks: 18,
    slightly_tight: 8,
    long_blocks: 14,
    some_long_blocks: 6,
    headline_rush: 10,
  };
  for (const i of issues) score -= penalties[i] || 6;
  score = clamp(score, 30, 100);

  const pass = score >= 70;
  const cssFix = pass ? null : buildUxFixCss(basePxFromTokens(tokens));
  return { score, issues, pass, cssFix };
}

export function injectCssIntoHead(html: string, css: string) {
  if (!css) return html;
  if (!/<\/head>/i.test(html)) {
    return `<style>${css}</style>\n${html}`;
  }
  return html.replace(/<\/head>/i, `<style>${css}</style>\n</head>`);
}
