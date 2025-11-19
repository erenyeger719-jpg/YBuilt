// server/qa/layout.solver.ts

import {
  decideLayoutGate,
  type LayoutGateInput,
  type LayoutGateOptions,
  type LayoutGateResult,
  type LayoutGateDecision,
} from "./layout.gate";

export interface LayoutPatchProposal {
  id: string;
  description?: string;
}

/**
 * Given the current state + gate, return a list of candidate patches.
 * Callers can encode whatever they like in the patch `id` / `description`,
 * e.g. "tighten line-height", "increase spacing", "lower max-width", etc.
 */
export type ProposePatchesFn = (
  state: LayoutGateInput,
  gate: LayoutGateResult
) => LayoutPatchProposal[];

/**
 * Apply a patch and return the new LayoutGateInput (with updated lqrScore,
 * a11y/perf hints, etc.). The solver only cares about these QA fields, not
 * the actual CSS strings.
 */
export type ApplyPatchFn = (
  state: LayoutGateInput,
  patch: LayoutPatchProposal
) => LayoutGateInput;

export interface LayoutSolverOptions {
  // Max iterations before we give up.
  maxIterations?: number; // default 3

  // LQR thresholds for the gate.
  gateOptions?: LayoutGateOptions;

  // Minimal LQR improvement to accept a patch.
  minLqrDelta?: number; // default 1
}

export interface LayoutSolverTraceStep {
  patch: LayoutPatchProposal;
  before: LayoutGateResult;
  after: LayoutGateResult;
}

export interface LayoutSolverResult {
  initial: LayoutGateResult;
  final: LayoutGateResult;
  decision: LayoutGateDecision;
  appliedPatches: LayoutPatchProposal[];
  trace: LayoutSolverTraceStep[];
}

/**
 * Generic "rhythm solver" loop.
 *
 * We don't know or care about actual CSS here – callers provide:
 * - how to propose patches
 * - how to apply a patch to get a new LQR / QA state
 *
 * We just:
 * 1) evaluate the current state via decideLayoutGate
 * 2) try patches that improve LQR / decision
 * 3) stop when we reach "ok" or cannot improve further.
 */
export function runLayoutSolver(
  initialInput: LayoutGateInput,
  proposePatches: ProposePatchesFn,
  applyPatch: ApplyPatchFn,
  opts: LayoutSolverOptions = {}
): LayoutSolverResult {
  const maxIterations =
    typeof opts.maxIterations === "number" &&
    Number.isFinite(opts.maxIterations) &&
    opts.maxIterations > 0
      ? Math.floor(opts.maxIterations)
      : 3;

  const minLqrDelta =
    typeof opts.minLqrDelta === "number" &&
    Number.isFinite(opts.minLqrDelta) &&
    opts.minLqrDelta > 0
      ? opts.minLqrDelta
      : 1;

  let currentInput: LayoutGateInput = { ...initialInput };
  let currentGate = decideLayoutGate(currentInput, opts.gateOptions);

  const appliedPatches: LayoutPatchProposal[] = [];
  const trace: LayoutSolverTraceStep[] = [];

  const initial = currentGate;

  // If we're already ok, nothing to do.
  if (currentGate.decision === "ok") {
    return {
      initial,
      final: currentGate,
      decision: currentGate.decision,
      appliedPatches,
      trace,
    };
  }

  const baseLqr = currentGate.lqrScore ?? 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const candidates = proposePatches(currentInput, currentGate);

    if (!candidates || candidates.length === 0) {
      break;
    }

    let bestPatch: LayoutPatchProposal | null = null;
    let bestGate: LayoutGateResult | null = null;

    for (const patch of candidates) {
      const nextInput = applyPatch(currentInput, patch);
      const nextGate = decideLayoutGate(nextInput, opts.gateOptions);

      const nextLqr = nextGate.lqrScore ?? baseLqr;
      const currentLqr = currentGate.lqrScore ?? baseLqr;
      const delta = nextLqr - currentLqr;

      // We only consider patches that actually improve LQR
      // and do not move us into a worse decision tier.
      const decisionRank = rankDecision(currentGate.decision);
      const nextRank = rankDecision(nextGate.decision);

      const isBetterDecision = nextRank > decisionRank;
      const isSameDecision = nextRank === decisionRank;

      if (delta < minLqrDelta && !isBetterDecision) {
        continue;
      }

      if (!bestGate) {
        bestPatch = patch;
        bestGate = nextGate;
      } else {
        const bestLqr = bestGate.lqrScore ?? baseLqr;
        const bestRank = rankDecision(bestGate.decision);

        // Prefer higher decision tier, then higher LQR.
        if (nextRank > bestRank) {
          bestPatch = patch;
          bestGate = nextGate;
        } else if (nextRank === bestRank && nextLqr > bestLqr) {
          bestPatch = patch;
          bestGate = nextGate;
        }
      }
    }

    // No patch improved the state in a meaningful way.
    if (!bestPatch || !bestGate) {
      break;
    }

    const nextInput = applyPatch(currentInput, bestPatch);

    trace.push({
      patch: bestPatch,
      before: currentGate,
      after: bestGate,
    });
    appliedPatches.push(bestPatch);

    currentInput = nextInput;
    currentGate = bestGate;

    if (currentGate.decision === "ok") {
      break;
    }
  }

  return {
    initial,
    final: currentGate,
    decision: currentGate.decision,
    appliedPatches,
    trace,
  };
}

function rankDecision(decision: LayoutGateDecision): number {
  switch (decision) {
    case "downgrade":
      return 0;
    case "patch":
      return 1;
    case "ok":
      return 2;
    default:
      return 0;
  }
}
