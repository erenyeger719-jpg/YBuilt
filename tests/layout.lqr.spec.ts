// tests/layout.lqr.spec.ts
import { describe, it, expect } from "vitest";
import {
  scoreLayoutQuality,
  type LayoutMetrics,
} from "../server/qa/layout.lqr";

describe("qa/layout.lqr – scoreLayoutQuality", () => {
  it("gives a high score for a calm layout", () => {
    const m: LayoutMetrics = {
      blocks: 20,
      avgCharsPerLine: 65,
      contrastIssues: 0,
      rhythmIssues: 0,
      viewportWidthPx: 1200,
    };

    const res = scoreLayoutQuality(m);
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.reasons.length).toBe(0);
  });

  it("penalizes long lines and density", () => {
    const calm: LayoutMetrics = {
      blocks: 20,
      avgCharsPerLine: 65,
      contrastIssues: 0,
      rhythmIssues: 0,
      viewportWidthPx: 1200,
    };

    const crowded: LayoutMetrics = {
      blocks: 60,                 // dense
      avgCharsPerLine: 110,       // long lines
      contrastIssues: 0,
      rhythmIssues: 0,
      viewportWidthPx: 1200,
    };

    const resCalm = scoreLayoutQuality(calm);
    const resCrowded = scoreLayoutQuality(crowded);

    expect(resCrowded.score).toBeLessThan(resCalm.score);
    expect(resCrowded.reasons).toContain("line_length_long");
    expect(resCrowded.reasons).toContain("density_high");
  });

  it("penalizes contrast and rhythm issues", () => {
    const base: LayoutMetrics = {
      blocks: 25,
      avgCharsPerLine: 70,
      contrastIssues: 0,
      rhythmIssues: 0,
      viewportWidthPx: 1024,
    };

    const bad: LayoutMetrics = {
      ...base,
      contrastIssues: 3,
      rhythmIssues: 2,
    };

    const resBase = scoreLayoutQuality(base);
    const resBad = scoreLayoutQuality(bad);

    expect(resBad.score).toBeLessThan(resBase.score);
    expect(resBad.reasons).toContain("contrast");
    expect(resBad.reasons).toContain("rhythm");
  });
});
