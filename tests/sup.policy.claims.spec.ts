// tests/sup.policy.claims.spec.ts
import { describe, it, expect } from "vitest";
import { computeRiskVector, supDecide } from "../server/sup/policy.core";

describe("sup/policy.core – evidence coverage gating", () => {
  it("does not add low_evidence_coverage when there are no claims", () => {
    const risk = computeRiskVector({
      prompt: "",
      copy: {
        HERO_TITLE: "Welcome",
        HERO_SUBHEAD: "Simple landing page.",
      },
      proof: {},
      perf: null,
      ux: null,
      a11yPass: null,
    });

    const decision = supDecide("/instant", risk);

    expect(risk.claim_total || 0).toBe(0);
    expect(decision.reasons).not.toContain("low_evidence_coverage");
  });

  it("adds low_evidence_coverage when claims exist but coverage is low", () => {
    const copy = {
      HERO_TITLE: "The best platform for 10x growth.",
    };
    const proof = {
      fact_counts: {
        total_claims: 5,
        with_evidence: 1,
      },
    };

    const risk = computeRiskVector({
      prompt: "",
      copy,
      proof,
      perf: null,
      ux: null,
      a11yPass: null,
    });

    // sanity: we really have claims + low coverage
    expect(risk.claim_total || 0).toBeGreaterThan(0);
    expect(typeof risk.evidence_coverage).toBe("number");
    expect(risk.evidence_coverage as number).toBeLessThan(0.5);

    const decision = supDecide("/instant", risk);

    expect(decision.reasons).toContain("low_evidence_coverage");
    // depending on other reasons, we expect at least strict (could be block if gate=strict)
    expect(["strict", "block"]).toContain(decision.mode);
  });
});
