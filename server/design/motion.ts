// server/design/motion.ts
export type MotionTokens = { cssVars: Record<string, string> };

export function motionVars(tone: "minimal" | "playful" | "serious" = "serious"): MotionTokens {
  const base = tone === "minimal" ? { fast: 120, normal: 220, slow: 360 }
             : tone === "playful" ? { fast: 140, normal: 260, slow: 420 }
             :                        { fast: 130, normal: 240, slow: 380 };

  const cssVars: Record<string, string> = {
    "--motion-fast": `${base.fast}ms`,
    "--motion-normal": `${base.normal}ms`,
    "--motion-slow": `${base.slow}ms`,
    "--easing-standard": "cubic-bezier(0.2, 0, 0, 1)",
    "--easing-emphasized": "cubic-bezier(0.32, 0, 0.2, 1)"
  };
  return { cssVars };
}
