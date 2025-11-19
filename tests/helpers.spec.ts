import { describe, it, expect } from "vitest";
import {
  hasRiskyClaims,
  inferAudience,
  segmentSwapSections,
  stableStringify,
} from "../server/ai/router.helpers.ts";

describe("helpers: risk & audience", () => {
  it("flags superlatives and percentages", () => {
    expect(hasRiskyClaims("We are #1 in the world")).toBe(true);
    expect(hasRiskyClaims("Boost CTR by 300%")).toBe(true);
    expect(hasRiskyClaims("Top choice for founders")).toBe(true);
    expect(hasRiskyClaims("Calm landing page, no claims")).toBe(false);
  });

  it("infers audience with precedence", () => {
    const spec = { summary: "For startup founders", copy: {} };
    expect(inferAudience(spec)).toBe("founders");
    const dev = { summary: "Tools for developers and engineers", copy: {} };
    expect(inferAudience(dev)).toBe("developers");
  });

  it("segmentSwapSections adjusts sections by audience", () => {
    const base = ["hero-basic", "cta-simple"];
    expect(segmentSwapSections(base, "developers")).toEqual(
      ["hero-basic", "cta-simple","features-3col"]
    );
    expect(segmentSwapSections(base, "founders")).toEqual(
      ["hero-basic","cta-simple","pricing-simple"]
    );
  });

  it("stableStringify is order-stable", () => {
    const a = { b:1, a:2 }, b = { a:2, b:1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
});
