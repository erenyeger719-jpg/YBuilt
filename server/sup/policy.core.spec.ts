// server/sup/policy.core.spec.ts
import { describe, it, expect } from "vitest";
import {
  computeRiskVector,
  supDecide,
  signProof,
  POLICY_VERSION,
  type RiskVector,
} from "./policy.core";

describe("policy.core – computeRiskVector", () => {
  it("gives low risk for empty / safe inputs", () => {
    const risk = computeRiskVector({
      prompt: "",
      copy: {},
      proof: {},
      perf: null,
      ux: null,
      a11yPass: null,
    });

    expect(risk.prompt_risk).toBe(false);
    expect(risk.copy_claims.superlative).toBe(0);
    expect(risk.copy_claims.missing_proof).toBe(0);
    expect(risk.pii.present).toBe(false);
    expect(risk.abuse_signals.sketchy).toBe(false);
  });

  it("counts claims and flags missing proof on CLAIMY_KEYS", () => {
    const risk = computeRiskVector({
      prompt: "We are #1 and 200% better",
      copy: {
        HEADLINE: "We are #1 in the world",
        TAGLINE: "Get 200% more conversions",
      },
      proof: {
        // PROOF is empty / not evidenced for the claimy keys
        // so missing_proof should go up
        HEADLINE: { status: "redacted" },
        TAGLINE: { status: "neutral" },
      },
      perf: { cls_est: 0.05, lcp_est_ms: 2000 },
      ux: { score: 90, issues: [] },
      a11yPass: true,
    });

    expect(risk.prompt_risk).toBe(true);
    expect(risk.copy_claims.superlative).toBeGreaterThan(0);
    expect(risk.copy_claims.percent).toBeGreaterThan(0);
    expect(risk.copy_claims.missing_proof).toBeGreaterThan(0);
  });

  it("raises perf risk when CLS/LCP are bad and a11y fails", () => {
    const risk = computeRiskVector({
      prompt: "",
      copy: {},
      proof: {},
      perf: { cls_est: 0.4, lcp_est_ms: 5000 },
      ux: { score: 80, issues: [] },
      a11yPass: false,
    });

    expect(risk.device_perf.cls_est).toBe(0.4);
    expect(risk.device_perf.lcp_est_ms).toBe(5000);
    expect(risk.a11y.pass).toBe(false);
  });

  it("detects basic PII patterns", () => {
    const risk = computeRiskVector({
      prompt: "Contact me at test@example.com",
      copy: {
        HERO_SUBHEAD: "Call us on +1 555-123-4567",
      },
      proof: {},
      perf: null,
      ux: null,
      a11yPass: null,
    });

    expect(risk.pii.present).toBe(true);
  });

  it("marks abuse signals when scammy language appears", () => {
    const risk = computeRiskVector({
      prompt: "This is guaranteed profit, free money pump and dump",
      copy: {},
      proof: {},
      perf: null,
      ux: null,
      a11yPass: null,
    });

    expect(risk.abuse_signals.sketchy).toBe(true);
    expect(risk.abuse_signals.reasons.length).toBeGreaterThan(0);
  });
});

describe("policy.core – supDecide", () => {
  it("allows very safe content", () => {
    const risk = computeRiskVector({
      prompt: "Just a normal prompt about a website",
      copy: {
        HEADLINE: "Welcome to our site",
      },
      proof: {},
      perf: { cls_est: 0.05, lcp_est_ms: 2000 },
      ux: { score: 90, issues: [] },
      a11yPass: true,
    });

    const decision = supDecide("/instant", risk as RiskVector);
    expect(decision.mode).toBe("allow");
    expect(decision.reasons).toEqual([]);
  });

  it("goes strict or block for unproven claims on compose routes", () => {
    const risk = computeRiskVector({
      prompt: "We are #1 and 1000% better",
      copy: {
        HEADLINE: "We are #1",
        TAGLINE: "1000% more conversions",
      },
      proof: {
        // none of these are evidenced → missing_proof increments
        HEADLINE: { status: "redacted" },
        TAGLINE: { status: "redacted" },
      },
      perf: { cls_est: 0.05, lcp_est_ms: 2000 },
      ux: { score: 90, issues: [] },
      a11yPass: true,
    });

    const decision = supDecide("/act/compose", risk as RiskVector);
    expect(["strict", "block"]).toContain(decision.mode);
    expect(decision.reasons).toContain("unproven_claims");
  });

  it("goes strict for very bad perf / a11y", () => {
    const risk = computeRiskVector({
      prompt: "",
      copy: {},
      proof: {},
      perf: { cls_est: 0.4, lcp_est_ms: 5000 },
      ux: { score: 60, issues: [] },
      a11yPass: false,
    });

    const decision = supDecide("/instant", risk as RiskVector);
    expect(["strict", "block"]).toContain(decision.mode);
    expect(decision.reasons).toContain("high_cls");
    expect(decision.reasons).toContain("slow_lcp");
  });
});

describe("policy.core – signProof", () => {
  it("returns a stable HMAC for same inputs", () => {
    const risk = computeRiskVector({
      prompt: "",
      copy: {},
      proof: {},
      perf: null,
      ux: null,
      a11yPass: null,
    });

    const s1 = signProof({
      pageId: "pg_123",
      policy_version: POLICY_VERSION,
      risk,
    });

    const s2 = signProof({
      pageId: "pg_123",
      policy_version: POLICY_VERSION,
      risk,
    });

    expect(s1).toBe(s2);
    // sha256 hex = 64 chars
    expect(s1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes signature when pageId changes", () => {
    const risk = computeRiskVector({
      prompt: "",
      copy: {},
      proof: {},
      perf: null,
      ux: null,
      a11yPass: null,
    });

    const s1 = signProof({
      pageId: "pg_123",
      policy_version: POLICY_VERSION,
      risk,
    });

    const s2 = signProof({
      pageId: "pg_456",
      policy_version: POLICY_VERSION,
      risk,
    });

    expect(s1).not.toBe(s2);
  });
});
