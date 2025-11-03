import { describe, it, expect } from "vitest";
import { sanitizeFacts } from "../server/intent/citelock";
import { sanitize } from "../server/ai/citelock.patch.ts";


describe("citelock sanitize", () => {
  it("neutralizes risky claims and flags fields", () => {
    const copy = {
      HEADLINE: "We are #1 with 200% growth and 10x ROI",
      HERO_SUBHEAD: "Leading platform for everyone",
      TAGLINE: "Top tool."
    };
    const { copyPatch, flags } = sanitizeFacts(copy as any) as any;
    const out = { ...copy, ...copyPatch };
    expect(flags.length).toBeGreaterThan(0);
    const joined = Object.values(out).join(" ");
    expect(/#1|200%|10x|Leading|Top/i.test(joined)).toBe(false);
  });
});
