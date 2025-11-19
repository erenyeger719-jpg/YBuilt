import { describe, it, expect } from "vitest";
import { buildSpec } from "../server/intent/brief";
import { nextActions } from "../server/intent/planner";
import { runWithBudget } from "../server/intent/budget";

describe("brief → planner → budget", () => {
  it("buildSpec is idempotent and preserves sections", () => {
    const { spec } = buildSpec({ prompt: "dark saas waitlist for founders" } as any);
    const { spec: spec2 } = buildSpec({ prompt: "dark saas waitlist for founders", lastSpec: spec } as any);
    expect(spec2.layout.sections.length).toBeGreaterThan(0);
    expect(spec2.layout.sections).toEqual(spec.layout.sections); // idempotent on same input
    expect(typeof spec2.brand?.dark).toBe("boolean");
  });

  it("planner returns actionable steps", () => {
    const { spec } = buildSpec({ prompt: "portfolio landing" } as any);
    const actions = nextActions(spec, {});
    expect(Array.isArray(actions)).toBe(true);
    for (const a of actions) expect(["retrieve","compose","ask","patch"].includes(a.kind)).toBe(true);
  });

  it("runWithBudget enforces caps", async () => {
    const session = "sess-budget";
    let calls = 0;
    const action = { kind: "retrieve", cost_est: 9999 } as any; // silly high cost
    const out = await runWithBudget(session, action, async () => { calls++; return { ok:true }; });
    expect(calls).toBe(0); // should short-circuit on over-budget
    expect(out).toMatchObject({ error: expect.any(String) });
  });
});
