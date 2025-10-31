import { describe, it, expect } from "vitest";
import { checkCopyReadability } from "../server/qa/readability.guard";

describe("readability", () => {
  it("scores 0..100 and only patches strings", () => {
    const copy = {
      HEADLINE: "THIS IS A VERY VERY LONG SHOUTY HEADLINE WITH A LOT OF WORDS THAT GO ON",
      HERO_SUBHEAD: "A dense block of text that probably wants to be calmer."
    } as any;
    const r: any = checkCopyReadability(copy);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    if (r.copyPatch) {
      for (const [k,v] of Object.entries(r.copyPatch)) {
        expect(typeof v === "string" || v === null).toBe(true);
        // no HTML introduced
        if (typeof v === "string") expect(v.includes("<")).toBe(false);
      }
    }
  });
});
