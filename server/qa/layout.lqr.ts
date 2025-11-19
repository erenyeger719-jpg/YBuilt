// server/qa/layout.lqr.ts

export type LayoutMetrics = {
  // Rough number of content blocks (sections, cards, etc.)
  blocks: number;
  // Average characters per line across main text content
  avgCharsPerLine: number;
  // Count of low-contrast text issues
  contrastIssues: number;
  // Count of spacing / rhythm issues (e.g. uneven vertical rhythm)
  rhythmIssues: number;
  // Viewport width in pixels (helps reason about line length)
  viewportWidthPx: number;
};

export type LayoutQualityResult = {
  score: number;    // 0..100, higher = calmer / better
  reasons: string[]; // e.g. ["line_length_long", "contrast", "density"]
};

function clampScore(x: number): number {
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x);
}

/**
 * Very small, deterministic layout quality “LQR”:
 * - Start from a high baseline.
 * - Subtract penalties for:
 *   - Overly long or short lines
 *   - Too many blocks (density)
 *   - Contrast issues
 *   - Rhythm/spacing issues
 */
export function scoreLayoutQuality(metrics: LayoutMetrics): LayoutQualityResult {
  const m = metrics || ({} as LayoutMetrics);

  let score = 90; // start optimistic, then subtract

  const reasons: string[] = [];

  const blocks = Number.isFinite(m.blocks) ? m.blocks : 0;
  const avgChars = Number.isFinite(m.avgCharsPerLine) ? m.avgCharsPerLine : 60;
  const contrast = Number.isFinite(m.contrastIssues) ? m.contrastIssues : 0;
  const rhythm = Number.isFinite(m.rhythmIssues) ? m.rhythmIssues : 0;
  const vp = Number.isFinite(m.viewportWidthPx) ? m.viewportWidthPx : 1200;

  // Line length: ideal-ish ~55–80 chars
  if (avgChars > 90) {
    reasons.push("line_length_long");
    const over = avgChars - 90;
    score -= Math.min(20, over / 2); // up to -20
  } else if (avgChars < 35) {
    reasons.push("line_length_short");
    score -= 5;
  }

  // Density: too many blocks → clutter
  if (blocks > 40) {
    reasons.push("density_high");
    score -= Math.min(15, (blocks - 40) * 0.5);
  }

  // Contrast issues: each one hurts a fair bit
  if (contrast > 0) {
    reasons.push("contrast");
    score -= Math.min(30, contrast * 5);
  }

  // Rhythm issues: uneven spacing / hierarchy
  if (rhythm > 0) {
    reasons.push("rhythm");
    score -= Math.min(20, rhythm * 4);
  }

  // Extremely narrow viewport with long lines is suspicious
  if (vp < 500 && avgChars > 80) {
    if (!reasons.includes("line_length_long")) {
      reasons.push("line_length_long");
    }
    score -= 5;
  }

  return {
    score: clampScore(score),
    reasons: Array.from(new Set(reasons)), // dedupe
  };
}
