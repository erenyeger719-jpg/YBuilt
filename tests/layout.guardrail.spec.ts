// tests/layout.guardrail.spec.ts
import { describe, it, expect } from "vitest";

import type { LayoutGateResult } from "../server/qa/layout.gate";
import { decideLayoutGuardrail } from "../server/qa/layout.guardrail";

function makeGate(
  decision: LayoutGateResult["decision"],
  lqrScore: number | null
): LayoutGateResult {
  // We only care about decision + lqrScore for the guardrail.
  return {
    decision,
    lqrScore,
  } as LayoutGateResult;
}

describe("qa/layout.guardrail – map layout gate to SUP guardrail", () => {
  it("treats an OK layout as allow/layout_ok", () => {
    const gate = makeGate("ok", 90);
    const outcome = decideLayoutGuardrail(gate);

    expect(outcome.mode).toBe("allow");
    expect(outcome.code).toBe("layout_ok");
    expect(outcome.lqrScore).toBe(90);
    expect(outcome.decision).toBe("ok");
  });

  it("treats a patch decision as patch/layout_needs_patch", () => {
    const gate = makeGate("patch", 75);
    const outcome = decideLayoutGuardrail(gate);

    expect(outcome.mode).toBe("patch");
    expect(outcome.code).toBe("layout_needs_patch");
    expect(outcome.lqrScore).toBe(75);
    expect(outcome.decision).toBe("patch");
  });

  it("treats a downgrade decision as block/layout_bad", () => {
    const gate = makeGate("downgrade", 45);
    const outcome = decideLayoutGuardrail(gate);

    expect(outcome.mode).toBe("block");
    expect(outcome.code).toBe("layout_bad");
    expect(outcome.lqrScore).toBe(45);
    expect(outcome.decision).toBe("downgrade");
  });

  it("handles null LQR scores gracefully", () => {
    const gate = makeGate("patch", null);
    const outcome = decideLayoutGuardrail(gate);

    expect(outcome.lqrScore).toBeNull();
  });
});
