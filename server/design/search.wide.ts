// server/design/search.wide.ts
// Deterministic "wide" token search around a given primary/tone/dark.
// Now with an HSL ring (hue/sat/light jitters) + eval memo to boost breadth
// while staying stable and cheap.

import { tokenMixer } from "./tokens.ts";
import { evaluateDesign } from "./score.ts";

// ----- types -----
type Tone = "minimal" | "playful" | "serious" | "brutalist";

type Candidate = { primary: string; tone: Tone; dark: boolean };
type Opts = { primary?: string; dark?: boolean; tone?: string };
type Result = {
  tokens: any;
  picked: { primary: string; tone: Tone; dark: boolean; score: number; a11y: boolean };
  tried: number;
  candidates: number;
  top5?: Array<{ primary: string; tone: Tone; dark: boolean; score: number; a11y: boolean }>;
};

// ----- tiny color helpers -----
function clamp(n: number, lo = 0, hi = 255) { return Math.min(hi, Math.max(lo, n)); }
function hexToRgb(hex: string) {
  const h = (hex || "").trim().replace(/^#/, "");
  if (h.length !== 3 && h.length !== 6) return null;
  const toByte = (s: string) => parseInt(s, 16);
  const rgb =
    h.length === 3
      ? [toByte(h[0] + h[0]), toByte(h[1] + h[1]), toByte(h[2] + h[2])]
      : [toByte(h.slice(0, 2)), toByte(h.slice(2, 4)), toByte(h.slice(4, 6))];
  if (rgb.some((v) => Number.isNaN(v))) return null;
  return { r: rgb[0], g: rgb[1], b: rgb[2] };
}
function rgbToHex(r: number, g: number, b: number) {
  const p = (x: number) => clamp(Math.round(x)).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
}

// rgb <-> hsl (s,l in [0,100], h in [0,360))
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
}
function hslToRgb(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

// tints/shades via RGB mix
function mix(rgb: { r: number; g: number; b: number }, withRgb: { r: number; g: number; b: number }, t: number) {
  const a = Math.max(0, Math.min(1, t));
  return { r: rgb.r * (1 - a) + withRgb.r * a, g: rgb.g * (1 - a) + withRgb.g * a, b: rgb.b * (1 - a) + withRgb.b * a };
}
function tint(hex: string, amt01: number) {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  const w = { r: 255, g: 255, b: 255 };
  const m = mix(rgb, w, amt01);
  return rgbToHex(m.r, m.g, m.b);
}
function shade(hex: string, amt01: number) {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  const k = { r: 0, g: 0, b: 0 };
  const m = mix(rgb, k, amt01);
  return rgbToHex(m.r, m.g, m.b);
}

// HSL ring jitter (small, deterministic)
function shiftHsl(hex: string, dh: number, ds: number, dl: number) {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const { r, g, b } = hslToRgb(hsl.h + dh, hsl.s + ds, hsl.l + dl);
  return rgbToHex(r, g, b);
}

// tiny deterministic hash to vary ring order (no randomness)
function stableHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619 >>> 0;
  return h >>> 0;
}

// Generate a small, deterministic palette neighborhood around a primary color.
function expandPrimaryPalette(primary: string) {
  const base = (primary || "#6d28d9").trim();
  const set = new Set<string>([
    base,
    tint(base, 0.08),
    tint(base, 0.16),
    tint(base, 0.24),
    shade(base, 0.08),
    shade(base, 0.16),
    shade(base, 0.24),
  ]);

  // HSL ring: ±8° hue, ±6% sat, ±6% light; keep compact
  const H = [-8, -4, 4, 8];
  const S = [-6, 6];
  const L = [-6, 6];

  // deterministic permutation based on color hash
  const h = stableHash(base);
  const hIdx = (i: number, n: number) => (i + (h % n)) % n;

  const Hp = H.map((_, i) => H[hIdx(i, H.length)]);
  const Sp = S.map((_, i) => S[hIdx(i, S.length)]);
  const Lp = L.map((_, i) => L[hIdx(i, L.length)]);

  // cap total ring variants to ~16 to keep compute tight
  for (let i = 0; i < Hp.length; i++) {
    for (let j = 0; j < Sp.length; j++) {
      for (let k = 0; k < Lp.length; k++) {
        if (set.size >= 1 + 6 + 16) break;
        set.add(shiftHsl(base, Hp[i], Sp[j], Lp[k]));
      }
    }
  }

  return Array.from(set);
}

// ----- tone helpers -----
const TONES: Tone[] = ["minimal", "playful", "serious", "brutalist"];
function normalizeTone(t?: string): Tone {
  const k = String(t || "").toLowerCase() as Tone;
  return (TONES as readonly Tone[]).includes(k) ? k : "serious";
}

// Tone ring we’re willing to explore around the requested tone.
const TONE_NEIGHBORHOOD: Record<Tone, Tone[]> = {
  minimal: ["minimal", "serious"],
  serious: ["serious", "minimal"],
  playful: ["playful", "minimal"],
  brutalist: ["brutalist", "serious"],
};

// Composite rank: a11y dominates, then visual score, then proximity to requested inputs.
function rankCandidate(c: Candidate, a11y: boolean, score: number, primaryIn: string, toneIn: Tone, darkIn: boolean) {
  const proximity =
    (c.primary.toLowerCase() === primaryIn.toLowerCase() ? 1 : 0) +
    (c.tone === toneIn ? 1 : 0) +
    (c.dark === darkIn ? 1 : 0);
  // weight a11y >> score >> proximity
  return (a11y ? 1 : 0) * 1e6 + score * 1e3 + proximity;
}

type Scored = { idx: number; candidate: Candidate; a11y: boolean; score: number; rank: number };

// --- memo for evaluateDesign over (primary,tone,dark) ---
const EVAL_MEMO = new Map<string, { a11y: boolean; score: number }>();
function scoreCandidate(c: Candidate) {
  const key = `${c.primary}|${c.tone}|${c.dark ? 1 : 0}`;
  const hit = EVAL_MEMO.get(key);
  if (hit) return hit;
  const tokens = tokenMixer({ primary: c.primary, dark: c.dark, tone: c.tone });
  const ev = evaluateDesign(tokens);
  const out = { a11y: !!ev.a11yPass, score: Number(ev.visualScore || 0) };
  EVAL_MEMO.set(key, out);
  return out;
}

export function wideTokenSearch(opts: Opts): Result {
  const primaryIn = (opts.primary || "#6d28d9").trim();
  const darkIn = !!opts.dark;
  const toneIn: Tone = normalizeTone(opts.tone);

  const primaries = expandPrimaryPalette(primaryIn);
  const tones: Tone[] = (TONE_NEIGHBORHOOD[toneIn] || [toneIn]).slice(0, 2);
  const darkFlags: boolean[] = [darkIn, !darkIn];

  const candidates: Candidate[] = [];
  for (const p of primaries) for (const t of tones) for (const d of darkFlags) {
    candidates.push({ primary: p, tone: t as Tone, dark: d });
  }

  // Score all candidates deterministically.
  const scored: Scored[] = candidates.map((c, idx) => {
    const s = scoreCandidate(c);
    const rank = rankCandidate(c, s.a11y, s.score, primaryIn, toneIn, darkIn);
    return { idx, candidate: c, a11y: s.a11y, score: s.score, rank };
  });

  // Fallback if, for any reason, we produced no candidates (paranoid guard)
  if (scored.length === 0) {
    const fallback: Candidate = { primary: primaryIn, tone: toneIn, dark: darkIn };
    const s = scoreCandidate(fallback);
    const tokens = tokenMixer(fallback);
    return {
      tokens,
      picked: { ...fallback, score: s.score, a11y: s.a11y },
      tried: 0,
      candidates: 0,
      top5: [{ ...fallback, score: s.score, a11y: s.a11y }],
    };
  }

  // Pick best by rank
  let best: Scored = scored[0];
  for (let i = 1; i < scored.length; i++) if (scored[i].rank > best.rank) best = scored[i];

  const winner = best.candidate;
  const tokens = tokenMixer({ primary: winner.primary, dark: winner.dark, tone: winner.tone });

  // Top-5 “explain” (a11y first, then visual score)
  const top5 = [...scored]
    .sort((a, b) => {
      if (a.a11y !== b.a11y) return a.a11y ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      return 0;
    })
    .slice(0, 5)
    .map((r) => ({ primary: r.candidate.primary, tone: r.candidate.tone, dark: r.candidate.dark, score: r.score, a11y: r.a11y }));

  return {
    tokens,
    picked: { primary: winner.primary, tone: winner.tone, dark: winner.dark, score: best.score, a11y: best.a11y },
    tried: scored.length,
    candidates: candidates.length,
    top5,
  };
}

export default wideTokenSearch;
