// tests/citelock.policy.spec.ts
import { describe, it, expect } from "vitest";
import {
  sanitizeFacts,
  buildProof,
  computeRiskVector,
  decideCopyGate,
} from "../server/intent/citelock";

describe("citelock policy core", () => {
  it("flags heavy marketing claims and blocks them in strict mode when evidence is missing", () => {
    const copy = {
      HEADLINE: "We are #1 with 200% growth and 10x ROI",
      HERO_SUBHEAD: "Leading platform for everyone",
    };

    // 1) ruthless sanitization
    const { copyPatch, flags } = sanitizeFacts(copy as any);
    const cleaned: Record<string, string> = { ...copy, ...copyPatch };

    // 2) build proof map from local corpus (or redacted if no evidence)
    const { proof } = buildProof(copy as any);

    // 3) compute risk vector
    const risk = computeRiskVector(cleaned, proof);

    // should be clearly non-trivial
    expect(flags.length).toBeGreaterThan(0);
    expect(risk.totalClaims).toBeGreaterThan(0);
    expect(risk.copy_claims).toBe("high");

    // 4) strict mode should block; "on" mode should not block hard
    const gateStrict = decideCopyGate(risk, "strict");
    const gateOn = decideCopyGate(risk, "on");

    expect(gateStrict).toBe("block");
    expect(["allow", "soften"]).toContain(gateOn);
  });

  it("lets neutral copy through even in strict mode", () => {
    const copy = {
      HEADLINE: "Practical landing pages for small teams",
      HERO_SUBHEAD: "Clear sections, fast load times, accessible layout.",
    };

    const { copyPatch, flags } = sanitizeFacts(copy as any);
    const cleaned: Record<string, string> = { ...copy, ...copyPatch };
    const { proof } = buildProof(copy as any);
    const risk = computeRiskVector(cleaned, proof);

    // no risky flags
    expect(flags.length).toBe(0);
    expect(risk.copy_claims).toBe("low");
    expect(decideCopyGate(risk, "strict")).toBe("allow");
  });
});
