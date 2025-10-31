import { describe, it, expect } from "vitest";
import { cheapCopy, guessBrand } from "../server/intent/copy";
import { fillSlots } from "../server/intent/slots";

describe("copy & slots", () => {
  it("cheapCopy is deterministic and avoids risky claims", () => {
    const intent = { vibe: "minimal", color_scheme: "dark", sections: ["hero-basic","cta-simple"] } as any;
    const a = cheapCopy("dark saas waitlist for founders", intent);
    const b = cheapCopy("dark saas waitlist for founders", intent);
    expect(a).toEqual(b);
    const joined = Object.values(a).join(" ");
    expect(/#1|10x|\d+\s?%|percent|top|best|leading/i.test(joined)).toBe(false);
    expect(guessBrand(intent)).toMatch(/^#|rgb|hsl/i); // colorish
  });

  it("fillSlots only adds/patches, never deletes", () => {
    const base = { HEADLINE: "Hi" } as any;
    const { copy } = fillSlots({
      prompt: "portfolio",
      spec: { layout: { sections: ["hero-basic","cta-simple"] } } as any,
      copy: base
    } as any) as any;
    expect(copy.HEADLINE).toBe("Hi");
    expect(Object.keys(copy).length).toBeGreaterThanOrEqual(Object.keys(base).length);
  });
});
