// client/src/types-and-helpers.ts
// @ts-ignore
import * as Y from "yjs";

/** -------------------- Types and Interfaces -------------------- **/
export type Spec = any;
export type DataSkin = "normal" | "empty" | "long" | "skeleton" | "error";
export type Role = "Edit" | "Review" | "Proof";
export type PersonaKey = "builder" | "mentor" | "analyst" | "playful";

export type HoverMsg = {
  type: "yb_hover";
  rect: { x: number; y: number; w: number; h: number };
  meta: {
    tag: string;
    sel?: string; // CSS-ish selector path for semantic anchoring
    role?: string;
    aria?: string;
    text?: string;
    style?: {
      color?: string;
      backgroundColor?: string;
      fontSize?: string;
      fontWeight?: string;
      lineHeight?: string;
      width?: string;
      height?: string;
      margin?: string;
      padding?: string;
    };
  };
};

export type CanvasComment = {
  id: string;
  path: string;
  x: number;
  y: number;
  text: string;
  ts: number;
  replies?: Array<{ id: string; text: string; ts: number }>;
  resolved?: boolean;
};

export type Macro = { 
  name: string; 
  steps: string[] 
};

export type ABState = {
  on: boolean;
  exp: string;
  arm: "A" | "B";
  A?: { url: string | null; pageId: string | null };
  B?: { url: string | null; pageId: string | null };
};

export type ABAutoConfig = {
  enabled: boolean;
  confidence: number; // for z-test mode
  minViews: number;
  minConv: number;
  seq: boolean; // strict sequential (Wald SPRT)
  power: number; // desired power for SPRT (1 - beta)
};

export type HistoryEntry = {
  ts: number;
  url: string | null;
  pageId: string | null;
  prompt: string;
  spec?: Spec;
};

export type CostMeta = {
  latencyMs: number;
  tokens: number;
  cents: number;
} | null;

/** -------------------- Constants -------------------- **/
export const VARIANT_HINTS: Record<string, string[]> = {
  "hero-basic": ["hero-basic", "hero-basic@b"],
  "features-3col": ["features-3col", "features-3col@alt"],
  "pricing-simple": ["pricing-simple", "pricing-simple@a"],
  "faq-accordion": ["faq-accordion", "faq-accordion@dense"],
};

export const GUARD = { 
  requireProof: true, 
  requireA11y: true, 
  maxCLS: 0.10, 
  maxLCPms: 2500 
};

/** -------------------- Helper Functions -------------------- **/
export const json = (body: any) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const postJson = (url: string, body: any) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export function rid(n = 10) {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: n }, () => a[(Math.random() * a.length) | 0]).join("");
}

export const baseOf = (s: string) => String(s).split("@")[0];

export const variantsFor = (s: string) => VARIANT_HINTS_FALLBACK(s);

export function VARIANT_HINTS_FALLBACK(s: string) {
  return VARIANT_HINTS[baseOf(s)] || [s];
}

/** -------------------- Comment Storage Functions -------------------- **/
export function loadComments(pid: string): CanvasComment[] {
  try {
    const db = JSON.parse(localStorage.getItem("yb_comments_v1") || "{}");
    return Array.isArray(db?.[pid]) ? db[pid] : [];
  } catch {
    return [];
  }
}

export function saveComments(pid: string, items: CanvasComment[]) {
  try {
    const db = JSON.parse(localStorage.getItem("yb_comments_v1") || "{}");
    db[pid] = items;
    localStorage.setItem("yb_comments_v1", JSON.stringify(db));
  } catch {}
}

/** -------------------- Macro Storage Functions -------------------- **/
export function loadMacros(): Macro[] {
  try {
    return JSON.parse(localStorage.getItem("yb_macros_v1") || "[]");
  } catch {
    return [];
  }
}

export function saveMacros(ms: Macro[]) {
  try {
    localStorage.setItem("yb_macros_v1", JSON.stringify(ms));
  } catch {}
}

export function exportMacros(macros: Macro[]) {
  try {
    const data = JSON.stringify(macros, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yb_macros.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch {}
}

export function importMacrosFromFile(file: File, existing: Macro[], onDone: (next: Macro[]) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result) || "[]");
      const arr: Macro[] = Array.isArray(raw) ? raw : [];
      const seen = new Set((existing || []).map((m) => m.name?.trim().toLowerCase()));
      const fresh = arr.filter((m) => m && m.name && !seen.has(m.name.trim().toLowerCase()));
      const next = [...existing, ...fresh];
      onDone(next);
      saveMacros(next);
    } catch {}
  };
  reader.readAsText(file);
}

/** -------------------- Color/Contrast Utils -------------------- **/
export function parseCssColor(c?: string): [number, number, number, number] | null {
  if (!c) return null;
  c = c.trim().toLowerCase();

  // rgba()/rgb()
  let m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([01]?\.?\d*))?\s*\)$/);
  if (m) {
    const a = m[4] != null ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1;
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), a];
  }

  // #rrggbb
  let h = c.match(/^#([0-9a-f]{6})$/i);
  if (h) {
    const r = parseInt(h[1].slice(0, 2), 16);
    const g = parseInt(h[1].slice(2, 4), 16);
    const b = parseInt(h[1].slice(4, 6), 16);
    return [r, g, b, 1];
  }

  // #rgb
  h = c.match(/^#([0-9a-f]{3})$/i);
  if (h) {
    const rr = h[1][0], gg = h[1][1], bb = h[1][2];
    const r = parseInt(rr + rr, 16);
    const g = parseInt(gg + gg, 16);
    const b = parseInt(bb + bb, 16);
    return [r, g, b, 1];
  }

  return null;
}

export function flattenOnWhite([r, g, b, a]: [number, number, number, number]): [number, number, number] {
  if (a >= 0.999) return [r, g, b];
  return [
    Math.round(255 * (1 - a) + r * a),
    Math.round(255 * (1 - a) + g * a),
    Math.round(255 * (1 - a) + b * a),
  ];
}

export function relLum([r, g, b]: [number, number, number]) {
  const srgb = [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function contrastRatio(fg: [number, number, number], bg: [number, number, number]) {
  const L1 = relLum(fg), L2 = relLum(bg);
  const [max, min] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (max + 0.05) / (min + 0.05);
}

/** -------------------- Presence/Color Functions -------------------- **/
export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const hue = (h >>> 0) % 360;
  return `hsl(${hue}, 85%, 55%)`;
}

/** -------------------- Math Helpers -------------------- **/
export function clamp01(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** -------------------- Statistical Functions for A/B Testing -------------------- **/
export function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

export function cdfStdNorm(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function zTest(
  A: { views: number; conv: number },
  B: { views: number; conv: number }
) {
  const vA = Math.max(1, A.views || 0);
  const vB = Math.max(1, B.views || 0);
  const cA = Math.max(0, A.conv || 0);
  const cB = Math.max(0, B.conv || 0);
  const pA = cA / vA;
  const pB = cB / vB;
  const pooled = (cA + cB) / (vA + vB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / vA + 1 / vB)) || 1e-9;
  const z = (pB - pA) / se;
  const higherIsB = pB >= pA;
  const conf = higherIsB ? cdfStdNorm(z) : cdfStdNorm(-z);
  const lift = pA > 0 ? ((pB - pA) / pA) * 100 : pB > 0 ? 100 : 0;
  return { conf, pA, pB, lift, winner: higherIsB ? ("B" as const) : ("A" as const) };
}

export function sprt(
  A: { views: number; conv: number },
  B: { views: number; conv: number },
  alpha = 0.05,
  power = 0.8,
  relMDE = 0.05
) {
  const vA = Math.max(1, A.views || 0);
  const cA = Math.max(0, A.conv || 0);
  const p0 = Math.min(0.999, Math.max(1e-6, cA / vA)); // baseline CTR
  const p1 = Math.min(0.999, Math.max(1e-6, p0 * (1 + relMDE))); // alternative CTR

  const vB = Math.max(1, B.views || 0);
  const cB = Math.max(0, B.conv || 0);

  const llr = cB * Math.log(p1 / p0) + (vB - cB) * Math.log((1 - p1) / (1 - p0));

  const beta = Math.max(1e-6, 1 - power);
  const A_th = Math.log(beta / (1 - alpha));
  const B_th = Math.log((1 - beta) / alpha);

  if (llr <= A_th) return { decided: true, winner: "A" as const, llr, A_th, B_th, p0, p1 };
  if (llr >= B_th) return { decided: true, winner: "B" as const, llr, A_th, B_th, p0, p1 };
  return { decided: false, winner: null as any, llr, A_th, B_th, p0, p1 };
}

/** -------------------- Pick Cost Meta -------------------- **/
export function pickCostMeta(c: any): CostMeta {
  if (!c || typeof c.tokens !== "number") return null;
  const latencyMs = Number(c.latencyMs ?? c.latency_ms ?? c.latency ?? 0);
  const cents =
    c.cents != null
      ? Number(c.cents)
      : c.usd_cents != null
      ? Number(c.usd_cents)
      : c.usd != null
      ? Number(c.usd) * 100
      : 0;
  return { latencyMs, tokens: Number(c.tokens), cents: Number(cents) };
}

/** -------------------- Section Blend Helper -------------------- **/
export function blendSections(current: string[] = [], winner: string[] = []) {
  const winByBase = new Map<string, string>();
  for (const sec of winner) winByBase.set(baseOf(sec), sec);
  const out = current.map((sec) => winByBase.get(baseOf(sec)) || sec);
  return out;
}