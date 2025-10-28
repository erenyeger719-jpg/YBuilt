// server/intent/router.brain.ts
import fs from "fs";
import path from "path";
import { expertsForTask } from "./experts.ts";

type PathKey = "rules" | "local" | "cloud";

type PathStats = {
  n: number;                 // requests routed to this path
  ships: number;             // produced a URL
  conversions: number;       // KPI conversions attributed to this path
  ema_ttu_ms: number | null; // time-to-url EMA
  ema_ship_rate: number | null;
  ema_conv_rate: number | null;
};

type ExpertStats = {
  n: number;
  ema_ms: number | null;
  cents: number;
  tokens: number;
};

type Stats = {
  paths: Record<PathKey, PathStats>;
  experts: Record<string, ExpertStats>;
  pageLabel: Record<string, PathKey>;   // pageId -> label path
  budget: { cloud_n: number; total_n: number };
  _meta?: { lastDecayTs?: number };
};

const FILE = path.resolve(".cache/router.stats.json");
const CACHE_DIR = path.dirname(FILE);

function ensureCache() {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
}

function defaultPathStats(): PathStats {
  return { n:0, ships:0, conversions:0, ema_ttu_ms:null, ema_ship_rate:null, ema_conv_rate:null };
}

// ---- time-decay to keep routing fresh ----
const DECAY_EVERY_MS = Number(process.env.ROUTER_DECAY_MS || 6 * 60 * 60 * 1000); // 6h
const DECAY_FACTOR   = Number(process.env.ROUTER_DECAY_FACTOR || 0.85);           // keep 85% weight

function maybeDecay(s: Stats): boolean {
  const now = Date.now();
  const last = s._meta?.lastDecayTs || 0;
  if (now - last < DECAY_EVERY_MS) return false;

  // paths
  for (const k of ["rules","local","cloud"] as PathKey[]) {
    const ps = s.paths[k] || defaultPathStats();
    ps.n = Math.max(0, Math.round(ps.n * DECAY_FACTOR));
    ps.ships = Math.max(0, Math.round(ps.ships * DECAY_FACTOR));
    ps.conversions = Math.max(0, Math.round(ps.conversions * DECAY_FACTOR));
    // keep EMAs as-is (already discounted over time via smoothing)
    s.paths[k] = ps;
  }

  // experts
  for (const key of Object.keys(s.experts || {})) {
    const ex = s.experts[key];
    if (!ex) continue;
    ex.n = Math.max(0, Math.round(ex.n * DECAY_FACTOR));
    // keep ema_ms (latency trend), keep cents/tokens (lifetime accounting)
    s.experts[key] = ex;
  }

  // budget (keeps cloud share but reduces history to react faster)
  s.budget.total_n = Math.max(0, Math.round(s.budget.total_n * DECAY_FACTOR));
  s.budget.cloud_n = Math.max(0, Math.round(s.budget.cloud_n * DECAY_FACTOR));

  s._meta = { ...(s._meta || {}), lastDecayTs: now };
  return true;
}

function readStats(): Stats {
  ensureCache();
  try {
    const j: Stats = JSON.parse(fs.readFileSync(FILE, "utf8"));
    // backfill structure if older file
    for (const k of ["rules","local","cloud"] as PathKey[]) {
      j.paths = j.paths || {} as any;
      j.paths[k] = j.paths[k] || defaultPathStats();
    }
    j.experts = j.experts || {};
    j.pageLabel = j.pageLabel || {};
    j.budget = j.budget || { cloud_n: 0, total_n: 0 };
    // opportunistic decay
    if (maybeDecay(j)) {
      try { fs.writeFileSync(FILE, JSON.stringify(j, null, 2)); } catch {}
    }
    return j;
  } catch {
    const j: Stats = {
      paths: { rules: defaultPathStats(), local: defaultPathStats(), cloud: defaultPathStats() },
      experts: {},
      pageLabel: {},
      budget: { cloud_n: 0, total_n: 0 },
      _meta: {}
    };
    // stamp first decay time so we start the clock
    j._meta = { lastDecayTs: Date.now() };
    try { fs.writeFileSync(FILE, JSON.stringify(j, null, 2)); } catch {}
    return j;
  }
}

function writeStats(s: Stats) {
  ensureCache();
  try { fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); } catch {}
}

function ema(prev: number|null, x: number, a = 0.25) {
  return prev == null ? x : (1 - a) * prev + a * x;
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

// ---------- PUBLIC: routing decisions ----------
export function decideLabelPath(): PathKey {
  const s = readStats();
  const maxCloudPct = Number(process.env.LABEL_MAX_CLOUD_PCT || 0.30); // 30% default
  const eps = Number(process.env.LABEL_EPSILON || 0.10);               // 10% explore

  const score = (k: PathKey) => {
    const ps = s.paths[k];
    const n = ps?.n || 0;

    const shipRate = ps.ema_ship_rate != null ? ps.ema_ship_rate : (ps.n ? ps.ships / ps.n : 0.5);
    const convRate = ps.ema_conv_rate != null ? ps.ema_conv_rate : (ps.n ? ps.conversions / ps.n : 0.03);
    const ttu = ps.ema_ttu_ms != null ? ps.ema_ttu_ms : 2500;
    const ttuScore = 1 - clamp01(ttu / 3000);

    // Heavier KPI weight; small-sample penalty to avoid early overfit
    const scantyPenalty = n < 5 ? (5 - n) * 0.02 : 0;

    let sc = 0.2 * shipRate + 0.7 * convRate + 0.1 * ttuScore - scantyPenalty;

    if (k === "cloud") {
      const share = s.budget.total_n ? s.budget.cloud_n / s.budget.total_n : 0;
      if (share > maxCloudPct) sc -= 0.3;
    }
    return sc;
  };

  const candidates: PathKey[] = ["rules", "local", "cloud"];

  if (Math.random() < eps) {
    const share = s.budget.total_n ? s.budget.cloud_n / s.budget.total_n : 0;
    const pool = share > maxCloudPct ? (["rules","local"] as PathKey[]) : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let best: PathKey = "rules";
  let bestScore = -1;
  for (const k of candidates) {
    const sc = score(k);
    if (sc > bestScore) { bestScore = sc; best = k; }
  }
  return best;
}

// called before making a cloud call to ensure policy/budget allows it
export function allowCloud(_opts: { cents?: number; tokens?: number } = {}): boolean {
  const s = readStats();
  const maxCloudPct = Number(process.env.LABEL_MAX_CLOUD_PCT || 0.30);
  const share = s.budget.total_n ? s.budget.cloud_n / s.budget.total_n : 0;
  return share <= maxCloudPct || Math.random() < 0.10;
}

// record per-expert telemetry (latency/cost)
export function recordExpertOutcome(expertKey: string, info: { success: boolean; ms?: number; cents?: number; tokens?: number }) {
  const s = readStats();
  const e = s.experts[expertKey] || { n: 0, ema_ms: null, cents: 0, tokens: 0 };
  e.n += 1;
  if (typeof info.ms === "number") e.ema_ms = ema(e.ema_ms, info.ms);
  if (typeof info.cents === "number") e.cents = Number((e.cents + info.cents).toFixed(4));
  if (typeof info.tokens === "number") e.tokens = (e.tokens || 0) + info.tokens;
  s.experts[expertKey] = e;
  writeStats(s);
}

// KPI update per label-path for a single /one cycle
export function outcomeLabelPath(path: PathKey, info: { startedAt?: number; shipped?: boolean; cloudUsed?: boolean; tokens?: number; cents?: number; pageId?: string }) {
  const s = readStats();
  const ps = s.paths[path] || defaultPathStats();

  ps.n += 1;
  s.budget.total_n += 1;
  if (path === "cloud") s.budget.cloud_n += 1;

  if (typeof info.startedAt === "number") {
    const ttu = Date.now() - info.startedAt;
    if (ttu > 0 && ttu < 120000) {
      ps.ema_ttu_ms = ema(ps.ema_ttu_ms, ttu);
    }
  }

  if (info.shipped) ps.ships += 1;
  ps.ema_ship_rate = ema(ps.ema_ship_rate, (info.shipped ? 1 : 0));

  if (info.pageId) {
    s.pageLabel[info.pageId] = path;
  }

  s.paths[path] = ps;
  writeStats(s);
}

// Attribute a KPI conversion back to the label path that produced the pageId
export function recordConversionForPage(pageId: string) {
  if (!pageId) return;
  const s = readStats();
  const path = s.pageLabel[pageId] as PathKey | undefined;
  if (!path) return;
  const ps = s.paths[path] || defaultPathStats();
  ps.conversions += 1;
  ps.ema_conv_rate = ema(ps.ema_conv_rate, 1);
  s.paths[path] = ps;
  writeStats(s);
}

// pick an expert model for a given task, honoring an optional cost cap
export function pickExpertFor(task: "planner"|"coder"|"critic", opts: { maxCents?: number } = {}) {
  const pool = expertsForTask(task, opts.maxCents);
  if (!Array.isArray(pool) || pool.length === 0) return null;

  const s = readStats();
  let best = pool[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const e of pool) {
    const ek = e.key || `${task}:${e.provider}:${e.model}`;
    const es = s.experts[ek] || null;
    const emaMs = es?.ema_ms ?? 1200; // assume 1.2s if unknown
    const cost = Number(e.cost_cents ?? 0.03);
    const score = emaMs + cost * 1000; // ~1c ≈ 1s penalty
    if (score < bestScore) { best = e; bestScore = score; }
  }
  return best;
}
