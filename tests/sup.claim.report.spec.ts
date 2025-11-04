import { describe, it, expect } from "vitest";
import { computeRiskVector } from "../server/sup/policy.core.ts";

describe("sup/claims – claim budget + policy snapshot", () => {
  it("marks neutral copy as ok with zero claims", () => {
    const risk = computeRiskVector({
      prompt: "",
      copy: {
        HEADLINE: "A calm, neutral headline.",
      },
      proof: {},
      perf: null,
      ux: null,
      a11yPass: true,
    });

    expect(risk.claim_total).toBe(0);
    expect(risk.claim_budget_state).toBe("ok");
    // still gives a policy snapshot (may be empty counts)
    expect(risk.claim_policy).toBeDefined();
  });

  it("flags heavy unproven marketing claims as warn/block", () => {
    const risk = computeRiskVector({
      prompt: "",
      copy: {
        HEADLINE: "We are the #1 fastest tool, 200% better than anyone else.",
      },
      proof: {}, // no evidence provided
      perf: null,
      ux: null,
      a11yPass: true,
    });

    expect((risk.claim_total || 0)).toBeGreaterThan(0);
    expect(risk.claim_budget_state === "warn" || risk.claim_budget_state === "block").toBe(true);

    // Claim policy snapshot should show superlative and percent claims
    const policy = risk.claim_policy as any;
    expect(policy).toBeDefined();
    expect(policy.superlative?.count ?? 0).toBeGreaterThan(0);
    expect(policy.percent?.count ?? 0).toBeGreaterThan(0);
  });
});
