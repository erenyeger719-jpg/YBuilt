import { describe, it, expect } from "vitest";
import { checkPerfBudget, downgradeSections, shouldStripJS } from "../server/perf/budgets";

describe("perf budgets", () => {
  const heavy = ["hero-basic","features-3col","pricing-simple","faq-accordion","cta-simple"];

  it("returns ok|overBy, never throws", () => {
    const r = checkPerfBudget(heavy);
    expect(r).toMatchObject({ ok: expect.any(Boolean) });
    if (!r.ok) expect(typeof (r as any).overBy).toBe("number");
  });

  it("downgrade never increases section count", () => {
    const d = downgradeSections(heavy);
    expect(Array.isArray(d)).toBe(true);
    expect(d.length).toBeLessThanOrEqual(heavy.length);
  });

  it("no-JS decision is boolean and stable", () => {
    expect(typeof shouldStripJS(heavy)).toBe("boolean");
  });
});
