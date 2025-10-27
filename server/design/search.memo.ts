// server/design/search.memo.ts
import fs from "fs";
import path from "path";
import { tokenMixer } from "./tokens.ts";
import { evaluateDesign } from "./score.ts";

type Tone = "minimal" | "playful" | "serious";

type Args = {
  primary: string; // hex
  dark: boolean;
  tone: Tone;
  goal?: string; // optional hint (waitlist/demo/purchase)
  industry?: string; // optional hint (saas/ecommerce/portfolio)
};

type TokenBundle = ReturnType<typeof tokenMixer>;

const CACHE_DIR = ".cache";
const CACHE_FILE = path.resolve(CACHE_DIR, "token.search.json");
const TASTE_FILE = path.resolve(CACHE_DIR, "taste.priors.json");

function ensureCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {}
}
function readJSON<T>(p: string, def: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return def;
  }
}
function writeJSON(p: string, v: any) {
  try {
    ensureCache();
    fs.writeFileSync(p, JSON.stringify(v, null, 2));
  } catch {}
}

function stable(o: any): string {
  if (Array.isArray(o)) return "[" + o.map(stable).join(",") + "]";
  if (o && typeof o === "object") {
    return (
      "{" +
      Object.keys(o)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stable(o[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(o);
}

function normHex(x = "") {
  const s = String(x).trim().toLowerCase();
  const h = s.startsWith("#") ? s : `#${s}`;
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h) ? h : "#6d28d9";
}

// --- tiny color tweak helpers (no deps) ---
function hexToRgb(h: string) {
  h = normHex(h).slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  const to = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return (
    "#" +
    [to(r), to(g), to(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}
function adjust(hex: string, pct: number) {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 + pct; // pct in [-0.3, +0.3]
  return rgbToHex(r * f, g * f, b * f);
}

// --- priors from TasteNet-lite ---
function readTasteBoost() {
  const pri = readJSON<{
    bias?: { primary?: string; dark?: boolean; tone?: string };
    top?: Array<[string, number, number, number]>;
  }>(TASTE_FILE, { bias: {}, top: [] });
  const topMap = new Map<string, number>();
  for (const row of pri.top || []) {
    const [key, score] = row;
    topMap.set(String(key), Number(score) || 0);
  }
  return { bias: pri.bias || {}, topMap };
}

function sig(brand: { primary?: string; dark?: boolean; tone?: string }) {
  return `${String((brand.primary || "").toLowerCase())}|${
    brand.dark ? "1" : "0"
  }|${String((brand.tone || "").toLowerCase())}`;
}

function priorBonus(candidate: { primary: string; dark: boolean; tone: Tone }) {
  try {
    const { bias, topMap } = readTasteBoost();
    const k = sig(candidate);
    const direct = topMap.get(k) ?? 0; // 0..1 (smoothed rate)
    let biasMatch = 0;
    if (bias.primary && bias.primary.toLowerCase() === candidate.primary.toLowerCase()) biasMatch += 0.03;
    if (typeof bias.dark === "boolean" && bias.dark === candidate.dark) biasMatch += 0.02;
    if (bias.tone && bias.tone === candidate.tone) biasMatch += 0.03;
    // cap + scale: at most ~+0.15 bonus
    return Math.min(0.15, direct * 0.12 + biasMatch);
  } catch {
    return 0;
  }
}

// generate a small but diverse candidate pool around the requested palette
function genCandidates({ primary, dark, tone }: Args) {
  const base = normHex(primary);
  const tones: Tone[] = Array.from(new Set<Tone>([tone, "minimal", "serious", "playful"].filter(Boolean) as Tone[]));
  const modes = [dark, !dark];

  const scales = [-0.18, -0.1, -0.05, 0, 0.06, 0.12]; // luminance-ish nudges
  const primaries = Array.from(new Set(scales.map((s) => adjust(base, s))));

  const out: Array<{ primary: string; dark: boolean; tone: Tone }> = [];
  for (const p of primaries) for (const d of modes) for (const t of tones) out.push({ primary: p, dark: d, tone: t });
  // keep it tight: ≤ 48 variants
  return out.slice(0, 48);
}

// --- tiny context nudges for goal/industry ---
function goalIndustryBonus(
  cand: { tone: Tone; dark: boolean },
  ctx: { goal?: string; industry?: string } = {}
) {
  const g = String(ctx.goal || "").toLowerCase();
  const i = String(ctx.industry || "").toLowerCase();
  let b = 0;

  // Industry heuristics (tiny, bounded)
  if (i === "saas") {
    if (cand.tone === "serious" || cand.tone === "minimal") b += 0.02;
    if (cand.dark === false) b += 0.01; // light defaults read cleaner in dashboards
  }
  if (i === "ecommerce") {
    if (cand.tone === "playful") b += 0.02; // friendlier shopping feel
  }
  if (i === "portfolio") {
    if (cand.tone === "minimal") b += 0.02; // quiet showcase bias
  }

  // Goal heuristics (tiny, bounded)
  if (g === "purchase") {
    b += 0.01; // general push to stronger contrast
    if (cand.dark === false) b += 0.01;
  }
  if (g === "waitlist") {
    if (cand.tone === "minimal") b += 0.015;
  }
  if (g === "demo" || g === "contact") {
    if (cand.tone === "serious") b += 0.015;
  }

  // cap to keep total fitness sane
  return Math.min(0.04, b);
}

// fitness with priors + context
function fitness(
  tokens: TokenBundle,
  cand: { primary: string; dark: boolean; tone: Tone },
  ctx?: { goal?: string; industry?: string }
) {
  const ev = evaluateDesign(tokens);
  if (!ev) return { score: 0, a11y: false, visual: 0 };
  let s = Number(ev.visualScore || 0) / 100;
  if (!ev.a11yPass) s *= 0.72; // hard penalty if fails a11y
  s += priorBonus(cand); // outcome prior
  s += goalIndustryBonus(cand, ctx || {}); // tiny hint bonus
  return { score: Number(s.toFixed(4)), a11y: !!ev.a11yPass, visual: Number(ev.visualScore || 0) };
}

export function searchBestTokensCached(args: Args) {
  ensureCache();
  const cache = readJSON<Record<string, any>>(CACHE_FILE, {});
  const key = stable({ v: 4, args }); // bump v if scoring changes
  if (cache[key] && cache[key]?.best) return cache[key];

  const cands = genCandidates(args);
  const scored: Array<{
    cand: { primary: string; dark: boolean; tone: Tone };
    tokens: TokenBundle;
    score: number;
    a11y: boolean;
    visual: number;
  }> = [];

  for (const c of cands) {
    try {
      const tokens = tokenMixer({ primary: c.primary, dark: c.dark, tone: c.tone });
      const fit = fitness(tokens, c, { goal: args.goal, industry: args.industry });
      scored.push({ cand: c, tokens, score: fit.score, a11y: fit.a11y, visual: fit.visual });
    } catch {}
  }

  scored.sort((a, b) => b.score - a.score || b.visual - a.visual);
  const best = scored[0]?.tokens || tokenMixer({ primary: args.primary, dark: args.dark, tone: args.tone });

  const top = scored.slice(0, 6).map((r) => ({
    primary: r.cand.primary,
    dark: r.cand.dark,
    tone: r.cand.tone,
    score: r.score,
    a11y: r.a11y,
    visual: r.visual,
  }));

  const out = { best, tried: scored.length, top };
  cache[key] = out;
  writeJSON(CACHE_FILE, cache);
  return out;
}
