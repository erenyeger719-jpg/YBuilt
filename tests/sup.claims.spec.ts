// tests/sup.claims.spec.ts
import { describe, it, expect } from "vitest";
import {
  classifyClaimsInText,
  countClaimsFromCopy,
  estimateEvidenceCoverage,
} from "../server/sup/claims";

describe("sup/claims – taxonomy + evidence budget", () => {
  it("classifies obvious claim patterns", () => {
    const kinds1 = classifyClaimsInText("We are the best platform for startups.");
    expect(kinds1).toContain("superlative");

    const kinds2 = classifyClaimsInText("Increase signups by 50% in 2 weeks.");
    expect(kinds2).toContain("percent");
    // also considered factual because of digits; we don't assert that here.

    const kinds3 = classifyClaimsInText("2x faster than competitors.");
    expect(kinds3).toContain("multiplier");
    expect(kinds3).toContain("comparative");

    const kinds4 = classifyClaimsInText(`I use this tool every day and love it.`);
    expect(kinds4).toContain("testimonial");
  });

  it("counts claims across nested copy objects", () => {
    const copy = {
      HERO_TITLE: "The best landing page generator.",
      HERO_SUB: "Ship pages 2x faster than before.",
      STATS: {
        LINE1: "Over 10,000 users and 95% satisfaction.",
      },
    };

    const counts = countClaimsFromCopy(copy);

    expect(counts.total).toBeGreaterThan(0);
    expect(counts.byKind.superlative).toBeGreaterThanOrEqual(1);
    expect(counts.byKind.multiplier).toBeGreaterThanOrEqual(1);
    expect(counts.byKind.percent).toBeGreaterThanOrEqual(1);
  });

  it("estimates evidence coverage from proof.fact_counts when present", () => {
    const proof = {
      fact_counts: {
        total_claims: 10,
        with_evidence: 7,
      },
    };

    const cov = estimateEvidenceCoverage(proof, 10);
    expect(cov).toBeGreaterThan(0.69);
    expect(cov).toBeLessThan(0.71);
  });

  it("returns 1 for coverage when there are no claims", () => {
    const cov = estimateEvidenceCoverage({}, 0);
    expect(cov).toBe(1);
  });

  it("returns 0 for coverage when there are claims but no proof", () => {
    const cov = estimateEvidenceCoverage(null as any, 5);
    expect(cov).toBe(0);
  });
});
