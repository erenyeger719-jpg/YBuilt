// client/src/pages/magicCursorLogic.ts

/**
 * Map a goal (0–100-ish) to the chips Magic Cursor should apply.
 * Low goal  = make it simpler.
 * Mid goal  = focus on email signup CTA.
 * High goal = email CTA + simplify.
 */
export function chipsForGoal(g: number): string[] {
  if (g < 34) return ["More minimal"];
  if (g < 67) return ["Use email signup CTA"];
  return ["Use email signup CTA", "More minimal"];
}
