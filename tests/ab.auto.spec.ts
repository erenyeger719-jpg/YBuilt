// tests/ab.auto.spec.ts
import { describe, it, expect } from "vitest";
import { zTest } from "../client/src/pages/types-and-helpers.ts";

describe("A/B auto-stop math – zTest", () => {
  it("picks B as winner with high confidence when B clearly lifts CTR", () => {
    const A = { views: 1000, conv: 50 }; // 5%
    const B = { views: 1000, conv: 80 }; // 8%

    const { winner, conf, pA, pB, lift } = zTest(A, B);

    expect(winner).toBe("B");
    expect(pA).toBeGreaterThan(0.04);
    expect(pA).toBeLessThan(0.06);
    expect(pB).toBeGreaterThan(0.07);
    expect(pB).toBeLessThan(0.09);
    expect(lift).toBeGreaterThan(0);
    // we don't care about the exact number, only that it's very confident
    expect(conf).toBeGreaterThan(0.9);
  });

  it("keeps confidence low when A and B are almost equal", () => {
    const A = { views: 1000, conv: 60 }; // 6%
    const B = { views: 1000, conv: 61 }; // 6.1%

    const { conf } = zTest(A, B);

    // near tie should not look 'super confident'
    expect(conf).toBeGreaterThan(0.4);
    expect(conf).toBeLessThan(0.9);
  });

  it("picks A as winner (and negative lift) when A converts better", () => {
    const A = { views: 1000, conv: 80 }; // 8%
    const B = { views: 1000, conv: 50 }; // 5%

    const { winner, lift } = zTest(A, B);

    expect(winner).toBe("A");
    // lift should be negative for B vs A
    expect(lift).toBeLessThan(0);
  });
});
