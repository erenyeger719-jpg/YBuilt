// server/sup/policy.ts
import fs from "fs";
import path from "path";

export type Gate = "off" | "on" | "strict";
export type RiskVector = {
  prompt_risk: number;    // 0..1
  copy_claims: number;    // 0..1
  device_perf: number;    // 0..1
  a11y: number;           // 0..1
  pii: number;            // 0..1
  abuse_signals: number;  // 0..1
};

export type EndpointPolicy = Partial<Record<keyof RiskVector, Gate>>;
export type Policy = {
  version: string;
  byEndpoint: Record<string, EndpointPolicy>; // key = route id, e.g. "compose", "instant", "review"
};

const POLICY_FILE = path.join("config", "policy.v2.json");

function defaultPolicy(): Policy {
  return {
    version: "v2.0",
    byEndpoint: {
      instant: { prompt_risk: "on", abuse_signals: "on", pii: "on", a11y: "off", device_perf: "off", copy_claims: "off" },
      compose: { prompt_risk: "on", abuse_signals: "on", pii: "on", copy_claims: "on", a11y: "on", device_perf: "on" },
      review:  { copy_claims: "on", a11y: "on", pii: "on" }
    }
  };
}

let cache: Policy | null = null;
export function loadPolicy(): Policy {
  try {
    const raw = fs.readFileSync(POLICY_FILE, "utf8");
    cache = JSON.parse(raw);
    return cache!;
  } catch {
    cache = defaultPolicy();
    try { fs.mkdirSync("config", { recursive: true }); fs.writeFileSync(POLICY_FILE, JSON.stringify(cache, null, 2)); } catch {}
    return cache!;
  }
}

export type ReqCtx = {
  endpoint: "instant" | "compose" | "review" | string;
  ua?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  bodyText?: string;   // raw copy when available
};

export function computeRisk(ctx: ReqCtx): RiskVector {
  const ua = (ctx.ua || "").toLowerCase();
  const text = (ctx.bodyText || "").toLowerCase();

  // ultra-light heuristics (deterministic). Improve later with features.
  const prompt_risk     = /jailbreak|ignore|bypass|prompt injection/.test(text) ? 0.9 : 0.05;
  const copy_claims     = /%|percent|best|#1|guarantee|fastest|increase|double|x\d/.test(text) ? 0.6 : 0.1;
  const device_perf     = /mobile|mobi|android|iphone/.test(ua) ? 0.3 : 0.1;
  const a11y            = /aria-|contrast|alt=/.test(text) ? 0.2 : 0.2; // placeholder signal
  const pii             = /email|phone|address|\bpan\b|\baudhaar\b|\bssn\b/.test(text) ? 0.5 : 0.05;
  const abuse_signals   = /mass|bulk|scrape|spam|ddos|auto-signup/.test(text) ? 0.8 : 0.05;

  return { prompt_risk, copy_claims, device_perf, a11y, pii, abuse_signals };
}

export function decide(ctx: ReqCtx, rv: RiskVector) {
  const policy = loadPolicy();
  const gates = policy.byEndpoint[ctx.endpoint] || {};
  const reasons: string[] = [];

  // simple comparator: gate ON triggers if risk >= 0.5; STRICT if risk >= 0.25
  function evalGate(g: Gate | undefined, r: number, key: keyof RiskVector) {
    if (!g || g === "off") return "pass";
    if (g === "on" && r >= 0.5) { reasons.push(`${String(key)}:on`); return "trip"; }
    if (g === "strict" && r >= 0.25) { reasons.push(`${String(key)}:strict`); return "trip"; }
    return "pass";
  }

  const decisions = Object.keys(rv).reduce<Record<keyof RiskVector, "pass" | "trip">>((acc, k) => {
    const key = k as keyof RiskVector;
    acc[key] = evalGate(gates[key], rv[key], key);
    return acc;
  }, {} as any);

  return {
    policyVersion: policy.version,
    gates: gates,
    decisions,
    reasons,
  };
}
