// server/ux/rhythm.ts
// Tiny, deterministic rhythm solver → emits a safe CSS patch.
// Inputs are hints; outputs are bounded and idempotent.

export type RhythmHints = {
  lqr?: number | null;           // 0..100
  cls_est?: number | null;       // 0..1 (ish)
  lcp_est_ms?: number | null;    // ms
  density?: "dense" | "normal" | "airy";
  base_px?: number;              // 14..20
  max_ch?: number;               // 55..75
  container_px?: number;         // 720..1200
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function buildRhythmCSS(h: RhythmHints = {}): { css: string; meta: any } {
  const lqr = typeof h.lqr === "number" ? clamp(h.lqr, 0, 100) : null;
  const cls = typeof h.cls_est === "number" ? clamp(h.cls_est, 0, 5) : null;
  const lcp = typeof h.lcp_est_ms === "number" ? clamp(h.lcp_est_ms, 0, 30000) : null;

  // Base knobs
  const basePx = clamp(h.base_px ?? 16, 14, 20);
  const maxCh = clamp(h.max_ch ?? 65, 55, 75);
  const containerPx = clamp(h.container_px ?? 1040, 720, 1200);
  const density = h.density ?? (lqr !== null && lqr < 70 ? "airy" : "normal");

  // Line-height + spacing scale
  let bodyLH = 1.6;           // default
  let stepRem = 0.75;         // base spacing step

  if (density === "airy") { bodyLH = 1.7; stepRem = 0.875; }
  if (density === "dense")  { bodyLH = 1.5; stepRem = 0.65; }

  // If layout is shaky (CLS high) or content too slow (LCP high), bias to more breathing room.
  if (cls !== null && cls > 0.25) { bodyLH = Math.max(bodyLH, 1.7); stepRem = Math.max(stepRem, 0.875); }
  if (lcp !== null && lcp > 2800) { stepRem = Math.max(stepRem, 0.875); }

  // Heading scale via clamp(): modest, viewport-aware.
  // Prevents giant headings that blow the first fold.
  const h1 = `clamp(${Math.round(basePx*1.8)}px, 2.2vw + 1rem, ${Math.round(basePx*2.4)}px)`;
  const h2 = `clamp(${Math.round(basePx*1.5)}px, 1.6vw + 0.9rem, ${Math.round(basePx*2.0)}px)`;
  const h3 = `clamp(${Math.round(basePx*1.3)}px, 1.2vw + 0.8rem, ${Math.round(basePx*1.6)}px)`;

  const css = `
/* --- UX Rhythm Patch (deterministic) --- */
:root{
  --rhythm-step:${stepRem}rem;
  --s0:calc(var(--rhythm-step)*0.5);
  --s1:var(--rhythm-step);
  --s2:calc(var(--rhythm-step)*1.5);
  --s3:calc(var(--rhythm-step)*2.0);
  --s4:calc(var(--rhythm-step)*3.0);
}
*{box-sizing:border-box}
html{font-size:${basePx}px}
body{
  line-height:${bodyLH};
  max-width:100%;
  margin:0;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
.container, .wrap, main, .main{
  max-width:min(${containerPx}px, 92vw);
  margin-inline:auto;
  padding-inline:var(--s1);
}
p, li{max-width:${maxCh}ch}
p{margin-block:var(--s1)}
ul,ol{padding-left:1.2em; margin-block:var(--s1)}
h1,h2,h3,h4{line-height:1.2; letter-spacing:-0.01em; margin:0 0 var(--s2) 0}
h1{font-size:${h1}}
h2{font-size:${h2}}
h3{font-size:${h3}}
section{margin-block:var(--s3)}
img,video,canvas{max-width:100%; height:auto; display:block}
button,[role="button"],a.button{padding:0.6em 1em}
blockquote{margin:var(--s2) 0; padding-left:var(--s1); border-left:3px solid rgba(0,0,0,.12)}
/* a11y nudges */
a{outline-offset:2px}
:focus-visible{outline:2px solid currentColor; outline-offset:2px}
/* --- End Rhythm Patch --- */
`.trim();

  return {
    css,
    meta: { basePx, maxCh, containerPx, bodyLH, stepRem, density, lqr, cls, lcp }
  };
}
