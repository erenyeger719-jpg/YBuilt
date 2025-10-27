// server/design/tokens.ts
export type Tone = "minimal" | "playful" | "serious";
export type TokenInput = { primary?: string; dark?: boolean; tone?: Tone };

export type DesignTokens = {
  cssVars: Record<string, string>;
  palette: { bg: string; fg: string; primary: string; primaryFg: string; muted: string; border: string };
  type: { basePx: number; scale: number; steps: number[] };
  space: { ramp: number[] }; // px
  shadow: { s: string; m: string; l: string };
  meta: { contrastOK: boolean; ratioPrimary: number; ratioText: number };
};

// ---------- color utils ----------
function clampHex(c?: string, fb = "#6d28d9") {
  const m = String(c || "").match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  return m ? m[0] : fb;
}
function hexToRgb(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(x => x + x).join("");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb(h: number, s: number, l: number) {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < .5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function hslToHex(h: number, s: number, l: number) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}
function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [f(r), f(g), f(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrast(a: string, b: string) {
  const L1 = luminance(a), L2 = luminance(b);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
function ensureContrast(fgHex: string, bgHex: string, min = 4.5) {
  let { h, s, l } = rgbToHsl(...Object.values(hexToRgb(fgHex)));
  let tries = 0; let best = fgHex; let bestC = contrast(best, bgHex);
  while (bestC < min && tries < 40) {
    l = Math.min(1, Math.max(0, l + (l > 0.5 ? -0.03 : -0.03))); // darken fg
    const cand = hslToHex(h, s, l);
    const c = contrast(cand, bgHex);
    if (c > bestC) { best = cand; bestC = c; }
    tries++;
  }
  return { fg: best, ratio: bestC, ok: bestC >= min };
}

// ---------- token mixer ----------
export function tokenMixer(input: TokenInput = {}): DesignTokens {
  const tone = input.tone || "serious";
  const primary = clampHex(input.primary, "#6d28d9");
  const bg = input.dark ? "#0b0b0b" : "#ffffff";
  const fgTarget = input.dark ? "#f4f4f5" : "#0b0b0b";
  const muted = input.dark ? "#171717" : "#f5f5f5";
  const border = input.dark ? "#262626" : "#e5e7eb";

  const { fg, ratio: textRatio, ok: textOK } = ensureContrast(fgTarget, bg, 7); // text stricter
  const baseOnPrimary = input.dark ? "#0b0b0b" : "#ffffff"; // prefer dark text on light, light text on dark
const { fg: primaryFg, ratio: primRatio, ok: primOK } = ensureContrast(baseOnPrimary, primary, 4.5);

  const basePx = tone === "minimal" ? 18 : tone === "playful" ? 17 : 16;
  const scale = tone === "minimal" ? 1.25 : tone === "playful" ? 1.22 : 1.2;
  const steps = [ -2,-1,0,1,2,3 ].map(n => Math.round(basePx * Math.pow(scale, n)));

  const spaceRamp = [4,8,12,16,24,32,48,64]; // tight→airy

  const cssVars: Record<string,string> = {
    "--color-bg": bg,
    "--color-fg": fg,
    "--color-primary": primary,
    "--color-on-primary": primaryFg,
    "--color-muted": muted,
    "--color-border": border,
    "--font-size-xs": `${steps[0]}px`,
    "--font-size-sm": `${steps[1]}px`,
    "--font-size-base": `${steps[2]}px`,
    "--font-size-lg": `${steps[3]}px`,
    "--font-size-xl": `${steps[4]}px`,
    "--font-size-2xl": `${steps[5]}px`,
    "--radius": tone === "minimal" ? "16px" : tone === "playful" ? "20px" : "12px",
    "--space-1": `${spaceRamp[0]}px`,
    "--space-2": `${spaceRamp[1]}px`,
    "--space-3": `${spaceRamp[2]}px`,
    "--space-4": `${spaceRamp[3]}px`,
    "--space-5": `${spaceRamp[4]}px`,
    "--space-6": `${spaceRamp[5]}px`,
    "--shadow-s": "0 1px 2px rgba(0,0,0,0.06)",
    "--shadow-m": "0 6px 16px rgba(0,0,0,0.08)",
    "--shadow-l": "0 18px 44px rgba(0,0,0,0.12)"
  };

  return {
    cssVars,
    palette: { bg, fg, primary, primaryFg, muted, border },
    type: { basePx, scale, steps },
    space: { ramp: spaceRamp },
    shadow: { s: cssVars["--shadow-s"], m: cssVars["--shadow-m"], l: cssVars["--shadow-l"] },
    meta: { contrastOK: textOK && primOK, ratioPrimary: primRatio, ratioText: textRatio }
  };
}
