// tests/layout.sup-gate.spec.ts
import { describe, it, expect } from "vitest";

import {
  decideLayoutSupGate,
} from "../server/qa/layout.sup-gate";

import type {
  LayoutGateInput,
  LayoutGateOptions,
} from "../server/qa/layout.gate";

describe("qa/layout.sup-gate – SUP-friendly layout gate wrapper", () => {
  const gateOpts: LayoutGateOptions = {
    hardFailThreshold: 60,
    softThreshold: 80,
  };

  it("treats a clearly good layout as allow (no block, no patch)", () => {
    const input: LayoutGateInput = {
      lqrScore: 90,
      hasA11yIssues: false,
      hasPerfIssues: false,
    };

    const result = decideLayoutSupGate(input, gateOpts);

    expect(result.guardrail.mode).toBe("allow");
    expect(result.guardrail.code).toBe("layout_ok");
    expect(result.shouldBlock).toBe(false);
    expect(result.shouldPatch).toBe(false);
    expect(result.gate.decision).toBe("ok");
  });

  it("treats a medium layout with issues as patch/layout_needs_patch", () => {
    const input: LayoutGateInput = {
      lqrScore: 75,
      hasA11yIssues: true,
      hasPerfIssues: false,
    };

    const result = decideLayoutSupGate(input, gateOpts);

    expect(result.guardrail.mode).toBe("patch");
    expect(result.guardrail.code).toBe("layout_needs_patch");
    expect(result.shouldPatch).toBe(true);
    expect(result.shouldBlock).toBe(false);
    expect(result.gate.decision === "patch" || result.gate.decision === "downgrade").toBe(true);
  });

  it("treats a clearly bad layout as block/layout_bad", () => {
    const input: LayoutGateInput = {
      lqrScore: 40,
      hasA11yIssues: true,
      hasPerfIssues: true,
    };

    const result = decideLayoutSupGate(input, gateOpts);

    expect(result.guardrail.mode).toBe("block");
    expect(result.guardrail.code).toBe("layout_bad");
    expect(result.shouldBlock).toBe(true);
    expect(result.shouldPatch).toBe(false);
    expect(result.gate.decision).toBe("downgrade");
  });
});
