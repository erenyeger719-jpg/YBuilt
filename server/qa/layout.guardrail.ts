// server/qa/layout.guardrail.ts

import type {
  LayoutGateResult,
  LayoutGateDecision,
} from "./layout.gate";

export type LayoutGuardrailMode = "allow" | "patch" | "block";

export interface LayoutGuardrailOutcome {
  mode: LayoutGuardrailMode;
  // Coarse SUP-style code you can log or surface in /metrics/guardrail, etc.
  code: "layout_ok" | "layout_needs_patch" | "layout_bad";
  // For debugging / dashboards.
  lqrScore: number | null;
  // Keep the raw decision around in case SUP wants to introspect.
  decision: LayoutGateDecision;
}

/**
 * Map a LayoutGateResult into a simple SUP guardrail outcome.
 *
 * This does NOT look at actual HTML or CSS; it trusts layout.gate's decision.
 * You can later wire this into supGuard / router.compose without changing
 * this module.
 */
export function decideLayoutGuardrail(
  gate: LayoutGateResult
): LayoutGuardrailOutcome {
  const lqr = gate.lqrScore ?? null;

  switch (gate.decision) {
    case "ok":
      return {
        mode: "allow",
        code: "layout_ok",
        lqrScore: lqr,
        decision: gate.decision,
      };

    case "patch":
      return {
        mode: "patch",
        code: "layout_needs_patch",
        lqrScore: lqr,
        decision: gate.decision,
      };

    case "downgrade":
    default:
      return {
        mode: "block",
        code: "layout_bad",
        lqrScore: lqr,
        decision: gate.decision,
      };
  }
}
