// tests/layout.solver.spec.ts
import { describe, it, expect } from "vitest";
import {
  runLayoutSolver,
  type LayoutPatchProposal,
} from "../server/qa/layout.solver";
import {
  decideLayoutGate,
  type LayoutGateInput,
  type LayoutGateOptions,
} from "../server/qa/layout.gate";

function makeGate(
  input: LayoutGateInput,
  opts?: LayoutGateOptions
) {
  return decideLayoutGate(input, opts);
}

describe("qa/layout.solver – rhythm solver loop", () => {
  const gateOpts: LayoutGateOptions = {
    hardFailThreshold: 60,
    softThreshold: 80,
  };

  it("fixes a bad page when a patch can lift LQR above the soft threshold", () => {
    const initial: LayoutGateInput = {
      lqrScore: 50,
      hasA11yIssues: false,
      hasPerfIssues: false,
    };

    const propose = (
      state: LayoutGateInput
    ): LayoutPatchProposal[] => {
      const gate = makeGate(state, gateOpts);
      // Only propose a patch when we are clearly bad.
      if (gate.decision === "downgrade") {
        return [
          {
            id: "increase-spacing",
            description: "Loosen rhythm / spacing",
          },
        ];
      }
      return [];
    };

    const apply = (
      state: LayoutGateInput,
      patch: LayoutPatchProposal
    ): LayoutGateInput => {
      if (patch.id === "increase-spacing") {
        // Pretend this patch dramatically improves layout quality.
        return {
          ...state,
          lqrScore: 85,
        };
      }
      return state;
    };

    const result = runLayoutSolver(initial, propose, apply, {
      gateOptions: gateOpts,
      maxIterations: 3,
      minLqrDelta: 1,
    });

    expect(result.initial.decision).toBe("downgrade");
    expect(result.final.decision).toBe("ok");
    expect(result.final.lqrScore).toBe(85);
    expect(result.appliedPatches.length).toBe(1);
    expect(result.appliedPatches[0].id).toBe("increase-spacing");
  });

  it("leaves the page downgraded when no patch clears the improvement threshold", () => {
    const initial: LayoutGateInput = {
      lqrScore: 40,
      hasA11yIssues: true,
      hasPerfIssues: true,
    };

    const propose = (): LayoutPatchProposal[] => {
      // We try some patch, but it won't be strong enough.
      return [
        {
          id: "minor-tweak",
          description: "Small tweak that barely helps",
        },
      ];
    };

    const apply = (
      state: LayoutGateInput,
      _patch: LayoutPatchProposal
    ): LayoutGateInput => {
      // Slight improvement, but not enough to pass minLqrDelta.
      return {
        ...state,
        lqrScore: state.lqrScore + 2,
      };
    };

    const result = runLayoutSolver(initial, propose, apply, {
      gateOptions: gateOpts,
      maxIterations: 2,
      minLqrDelta: 5, // requires a meaningful jump
    });

    // Solver looked at the patch, saw it's too weak, and owns the downgrade.
    expect(result.initial.decision).toBe("downgrade");
    expect(result.final.decision).toBe("downgrade");
    expect(result.appliedPatches.length).toBe(0);
  });
});
