import { describe, it, expect } from "vitest";
import {
  checkCopyReadability,
  checkCopyReadabilityForLocale,
} from "../server/qa/readability.guard";

describe("readability", () => {
  it("scores 0..100 and only patches strings", () => {
    const copy = {
      HEADLINE:
        "THIS IS A VERY VERY LONG SHOUTY HEADLINE WITH A LOT OF WORDS THAT GO ON",
      HERO_SUBHEAD:
        "A dense block of text that probably wants to be calmer.",
    } as any;
    const r: any = checkCopyReadability(copy);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    if (r.copyPatch) {
      for (const [k, v] of Object.entries(r.copyPatch)) {
        expect(typeof v === "string" || v === null).toBe(true);
        // no HTML introduced
        if (typeof v === "string") expect(v.includes("<")).toBe(false);
      }
    }
  });

  it("exposes locale-aware layout policy from readability helper", () => {
    const sample = {
      hero: {
        heading: "Hello world",
        subheading: "This is a simple test string.",
      },
    };

    const latin = checkCopyReadabilityForLocale(sample as any, "en-US");
    const cjk = checkCopyReadabilityForLocale(sample as any, "ja-JP");

    // Both should still have a numeric readability score from the base helper
    expect(typeof latin.score).toBe("number");
    expect(typeof cjk.score).toBe("number");

    // Now we can see the layout policy attached per locale/script:
    expect(latin.layoutPolicy.script).toBe("latin");
    expect(cjk.layoutPolicy.script).toBe("cjk");

    // CJK should prefer shorter comfortable line lengths than Latin:
    expect(cjk.layoutPolicy.maxLineLengthCh).toBeLessThan(
      latin.layoutPolicy.maxLineLengthCh
    );
  });
});
