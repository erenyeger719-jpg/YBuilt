// server/qa/layout.sup-gate.ts

import {
  decideLayoutGate,
  type LayoutGateInput,
  type LayoutGateOptions,
  type LayoutGateResult,
} from "./layout.gate";

import {
  decideLayoutGuardrail,
  type LayoutGuardrailOutcome,
} from "./layout.guardrail";

export interface LayoutSupGateResult {
  // Raw layout gate result (LQR + issues → ok/patch/downgrade)
  gate: LayoutGateResult;
  // SUP-style guardrail outcome (allow/patch/block)
  guardrail: LayoutGuardrailOutcome;
  // Convenience booleans for SUP/router code.
  shouldBlock: boolean;
  shouldPatch: boolean;
}

/**
 * Run the layout gate + map it into a SUP-style guardrail.
 *
 * This is pure, side-effect-free, and does not touch HTML/CSS or Express.
 * Routers / supGuard can call this and decide what to do with the answer.
 */
export function decideLayoutSupGate(
  input: LayoutGateInput,
  opts?: LayoutGateOptions
): LayoutSupGateResult {
  const gate = decideLayoutGate(input, opts);
  const guardrail = decideLayoutGuardrail(gate);

  return {
    gate,
    guardrail,
    shouldBlock: guardrail.mode === "block",
    shouldPatch: guardrail.mode === "patch",
  };
}
