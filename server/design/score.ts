// server/design/score.ts
import { DesignTokens } from "./tokens.ts";

export type DesignEval = { visualScore: number; a11yPass: boolean; notes: string[] };

export function evaluateDesign(tokens: DesignTokens): DesignEval {
  const notes: string[] = [];

  // a11y: contrast + base font
  const a11yPass = tokens.meta.contrastOK && tokens.type.basePx >= 16;
  if (!tokens.meta.contrastOK) notes.push("contrast_low");
  if (tokens.type.basePx < 16) notes.push("text_too_small");

  // Taste heuristic (0..100): spacing generosity + contrast + simplicity
  const spacing = tokens.space.ramp;
  const generosity = Math.min(1, (spacing[5] || 32) / 64);        // big space = calmer
  const contrast = Math.min(1, tokens.meta.ratioText / 10);       // 7+ is great
  const simplicity = 1;                                           // single primary
  const typeWeight = Math.min(1, (tokens.type.scale - 1.15) / 0.15);

  const visualScore = Math.round(100 * (0.35*generosity + 0.35*contrast + 0.2*simplicity + 0.1*typeWeight));
  if (visualScore < 70) notes.push("style_low");

  return { visualScore, a11yPass, notes };
}
