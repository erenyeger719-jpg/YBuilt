// tests/layout.gate.spec.ts
import { describe, it, expect } from "vitest";
import {
  decideLayoutGate,
  type LayoutGateInput,
} from "../server/qa/layout.gate";

describe("qa/layout.gate – LQR gating", () => {
  it("returns ok for high LQR with no issues", () => {
    const input: LayoutGateInput = {
      lqrScore: 90,
      hasA11yIssues: false,
      hasPerfIssues: false,
    };

    const result = decideLayoutGate(input);

    expect(result.decision).toBe("ok");
    expect(result.reason).toBe("good_lqr_and_no_issues");
    expect(result.lqrScore).toBe(90);
  });

  it("patches when LQR is medium or when a11y/perf issues exist", () => {
    // Medium LQR between hardFail=60 and soft=80
    const medium: LayoutGateInput = {
      lqrScore: 70,
      hasA11yIssues: false,
      hasPerfIssues: false,
    };

    const mediumResult = decideLayoutGate(medium);
    expect(mediumResult.decision).toBe("patch");
    expect(mediumResult.reason).toBe("lqr_between_hard_and_soft");

    // High LQR but with a11y issues
    const highWithIssues: LayoutGateInput = {
      lqrScore: 85,
      hasA11yIssues: true,
      hasPerfIssues: false,
    };

    const highWithIssuesResult = decideLayoutGate(highWithIssues);
    expect(highWithIssuesResult.decision).toBe("patch");
    expect(highWithIssuesResult.reason).toBe("good_lqr_but_a11y_issues");
  });

  it("downgrades when LQR is clearly bad", () => {
    const bad: LayoutGateInput = {
      lqrScore: 40,
      hasA11yIssues: true,
      hasPerfIssues: true,
    };

    const result = decideLayoutGate(bad);

    expect(result.decision).toBe("downgrade");
    expect(result.reason).toBe("lqr_below_hard_fail");
  });
});
