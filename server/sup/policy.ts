// server/sup/policy.ts
import crypto from "crypto";

export type Gate = "off" | "on" | "strict";
export type RiskVector = {
  prompt_risk: number;   // jailbreaky prompts, self-harm, illegal, etc. 0..1
  copy_claims: number;   // superlatives/claims needing proof 0..1
  device_perf: number;   // low-perf signals → risk of bad UX 0..1
  a11y: number;          // accessibility risk from heuristics 0..1
  PII: number;           // emails, phones, gov IDs found 0..1
  abuse_signals: number; // velocity, entropy, disposable mail 0..1
};

export type GateMap = { [K in keyof RiskVector]: Gate };

export const POLICY_VERSION =
  process.env.SUP_POLICY_VERSION || "2025-10-25.v1";

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

const reEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const rePhone = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/;
const reClaims = /\b(best|#1|guaranteed|fastest|lowest|no\.?1|100%|lifetime)\b/i;
const reJail = /\b(jailbreak|bypass|crack|step[-\s]?by[-\s]?step exploit|payload)\b/i;

export function computeRiskVector(input: {
  prompt?: string;
  copy?: string;
  ua?: string;
  disposableMail?: boolean;
  velocityScore?: number; // 0..1 from your counters (optional)
}): RiskVector {
  const prompt = input.prompt || "";
  const copy = input.copy || "";
  const ua = (input.ua || "").toLowerCase();

  const prompt_risk = clamp01(
    (reJail.test(prompt) ? 0.8 : 0) + (prompt.length > 4000 ? 0.2 : 0)
  );

  const copy_claims = clamp01(
    (reClaims.test(copy) ? 0.7 : 0) +
    ((copy.match(/%/g) || []).length > 2 ? 0.2 : 0)
  );

  const PII = clamp01(
    (reEmail.test(copy) ? 0.5 : 0) + (rePhone.test(copy) ? 0.5 : 0)
  );

  const device_perf = clamp01(
    (ua.includes("android") || ua.includes("iphone")) ? 0.2 : 0
  );

  const a11y = 0.1; // placeholder until Real-DOM audit feeds this
  const abuse_signals = clamp01((input.disposableMail ? 0.6 : 0) + (input.velocityScore || 0));

  return { prompt_risk, copy_claims, device_perf, a11y, PII, abuse_signals };
}

export function decideGates(v: RiskVector, endpoint: string): GateMap {
  const pick = (score: number): Gate => (score >= 0.8 ? "strict" : score >= 0.4 ? "on" : "off");

  // Endpoint-specific tightening (e.g., /compose stricter on claims & PII)
  const bias: Partial<RiskVector> = endpoint.includes("compose")
    ? { copy_claims: v.copy_claims + 0.1, PII: v.PII + 0.1 }
    : {};

  const vv: RiskVector = {
    prompt_risk: clamp01(v.prompt_risk + (bias.prompt_risk || 0)),
    copy_claims: clamp01(v.copy_claims + (bias.copy_claims || 0)),
    device_perf: clamp01(v.device_perf + (bias.device_perf || 0)),
    a11y: clamp01(v.a11y + (bias.a11y || 0)),
    PII: clamp01(v.PII + (bias.PII || 0)),
    abuse_signals: clamp01(v.abuse_signals + (bias.abuse_signals || 0)),
  };

  return {
    prompt_risk: pick(vv.prompt_risk),
    copy_claims: pick(vv.copy_claims),
    device_perf: pick(vv.device_perf),
    a11y: pick(vv.a11y),
    PII: pick(vv.PII),
    abuse_signals: pick(vv.abuse_signals),
  };
}

export function contentHash(s: string) {
  return crypto.createHash("sha256").update(s || "").digest("hex");
}
