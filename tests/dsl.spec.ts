// tests/dsl.spec.ts
import { describe, it, expect } from "vitest";
import { verifyAndPrepare, defaultsForSections, hardenCopy } from "../server/intent/dsl";

describe("dsl contracts", () => {
  it("verifyAndPrepare returns ordered, non-empty sections", () => {
    const prep = verifyAndPrepare({ sections: ["hero-basic","cta-simple"] } as any);
    expect(prep.sections.length).toBeGreaterThan(0);
    expect(prep.sections[0]).toBe("hero-basic");
  });

  it("hardenCopy fills defaults but preserves user fields", () => {
    const secs = ["hero-basic","cta-simple"];
    const defs = defaultsForSections(secs);
    const out = hardenCopy(secs, { ...defs, HEADLINE: "Custom" } as any);
    expect(out.HEADLINE).toBe("Custom");
    for (const k of Object.keys(defs)) expect(out[k]).toBeTruthy();
  });
});
