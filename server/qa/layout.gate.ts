// server/qa/layout.gate.ts

export type LayoutGateDecision = "ok" | "patch" | "downgrade";

export interface LayoutGateInput {
  // Layout Quality Rating (0..100). May be null/undefined when unknown.
  lqrScore?: number | null;

  // Hints from other QA checks
  hasA11yIssues?: boolean;
  hasPerfIssues?: boolean;
}

export interface LayoutGateOptions {
  // Below this score, layout is considered clearly bad and should be downgraded.
  hardFailThreshold?: number; // default 60

  // Below this score, we should at least patch (but maybe still ship).
  softThreshold?: number; // default 80
}

export interface LayoutGateResult {
  decision: LayoutGateDecision;
  reason: string;
  lqrScore: number | null;
  hardFailThreshold: number;
  softThreshold: number;
}

/**
 * Decide what to do with a page based on its LQR score and QA hints.
 *
 * - LQR >= softThreshold and no issues → "ok"
 * - LQR between hardFailThreshold and softThreshold, or with a11y/perf issues → "patch"
 * - LQR < hardFailThreshold → "downgrade"
 *
 * This is intentionally simple and deterministic so SUP / perf governors
 * can call it without surprises.
 */
export function decideLayoutGate(
  input: LayoutGateInput,
  opts: LayoutGateOptions = {}
): LayoutGateResult {
  const hardFailThreshold =
    typeof opts.hardFailThreshold === "number" &&
    Number.isFinite(opts.hardFailThreshold)
      ? opts.hardFailThreshold
      : 60;

  const softThreshold =
    typeof opts.softThreshold === "number" &&
    Number.isFinite(opts.softThreshold)
      ? opts.softThreshold
      : 80;

  const rawScore =
    typeof input.lqrScore === "number" && Number.isFinite(input.lqrScore)
      ? input.lqrScore
      : null;

  const hasA11y = !!input.hasA11yIssues;
  const hasPerf = !!input.hasPerfIssues;

  let decision: LayoutGateDecision = "ok";
  let reason = "ok";

  if (rawScore === null) {
    // No LQR available -> be conservative but not fatal.
    if (hasA11y || hasPerf) {
      decision = "patch";
      reason = "no_lqr_but_issues";
    } else {
      decision = "patch";
      reason = "no_lqr_score";
    }
  } else if (rawScore < hardFailThreshold) {
    decision = "downgrade";
    reason = "lqr_below_hard_fail";
  } else if (rawScore < softThreshold) {
    decision = "patch";
    reason = "lqr_between_hard_and_soft";
  } else if (hasA11y || hasPerf) {
    decision = "patch";
    reason = hasA11y && hasPerf
      ? "good_lqr_but_a11y_and_perf_issues"
      : hasA11y
      ? "good_lqr_but_a11y_issues"
      : "good_lqr_but_perf_issues";
  } else {
    decision = "ok";
    reason = "good_lqr_and_no_issues";
  }

  return {
    decision,
    reason,
    lqrScore: rawScore,
    hardFailThreshold,
    softThreshold,
  };
}
