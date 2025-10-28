// server/design/search.wide.ts
import { tokenMixer } from "./tokens.ts";
import { evaluateDesign } from "./score.ts";

type Opts = { primary: string; dark: boolean; tone: string };

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function hexToRgb(hex: string) {
  const m = String(hex || "").trim().replace(/^#/, "");
  const v = m.length === 3 ? m.split("").map(ch => ch + ch).join("") : m;
  const n = parseInt(v || "0", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(x => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0")).join("");
}
function shift(hex: string, amt: number) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + amt, g + amt, b + amt);
}

function uniq<T>(arr: T[]) { return Array.from(new Set(arr)); }

export function wideTokenSearch(opts: Opts) {
  const prim = String(opts.primary || "#6d28d9");
  const tones = uniq([opts.tone, "minimal", "serious", "playful"].filter(Boolean)) as Array<"minimal"|"serious"|"playful">;
  const darks = uniq([Boolean(opts.dark), !opts.dark]);

  // small palette wiggles
  const prims = uniq([prim, shift(prim, 14), shift(prim, -14), shift(prim, 28), shift(prim, -28)]);

  type Cand = { score: number; tokens: any; a11y: boolean; visual: number; primary: string; tone: string; dark: boolean };
  const cands: Cand[] = [];

  for (const p of prims) {
    for (const t of tones) {
      for (const d of darks) {
        try {
          const tokens = tokenMixer({ primary: p, tone: t, dark: d });
          const ev = evaluateDesign(tokens);
          const a11y = !!ev.a11yPass;
          const visual = Number(ev.visualScore || 0);
          // scoring: privilege a11y, then visual; slight bias toward minimal for robustness
          const toneBias = t === "minimal" ? 2 : 0;
          const score = (a11y ? 20 : 0) + visual + toneBias;
          cands.push({ score, tokens, a11y, visual, primary: p, tone: t, dark: d });
        } catch {}
      }
    }
  }

  cands.sort((a, b) => b.score - a.score);
  const top = cands[0] || null;

  return {
    tokens: top?.tokens || null,
    tried: cands.length,
    a11y_pass_rate: cands.length ? Math.round(100 * (cands.filter(c => c.a11y).length / cands.length)) : null,
    topCandidates: cands.slice(0, 5).map(c => ({ score: Math.round(c.score), a11y: c.a11y, visual: Math.round(c.visual), primary: c.primary, tone: c.tone, dark: c.dark })),
  };
}
