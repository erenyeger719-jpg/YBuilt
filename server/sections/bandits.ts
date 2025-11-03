// server/sections/bandits.ts
import fs from "fs";
import path from "path";

type Audience = string; // e.g. "all" | "developers" | "founders"
type Stats = { a: number; b: number; seen: number; win: number; last?: number };
type ArmDB = { [variantId: string]: Stats };
type Key = string; // `${audience}|${baseId}`

const FILE = path.resolve(".cache/sections.bandits.json");

function readDB(): Record<Key, ArmDB> {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}
function writeDB(db: Record<Key, ArmDB>) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2), "utf8");
  } catch {
    /* degrade silently */
  }
}

function baseOf(id: string) {
  return String(id).split("@")[0];
}
function now() {
  return Date.now();
}

function ensureArm(db: Record<Key, ArmDB>, key: Key, variant: string) {
  db[key] ||= {};
  db[key][variant] ||= { a: 1, b: 1, seen: 0, win: 0, last: now() }; // Beta(1,1)
}

function sampleBeta(a: number, b: number) {
  // quick-and-cheap sampler using inverse-CDF-ish trick
  const u1 = Math.random() || 0.0001;
  const u2 = Math.random() || 0.0001;
  const x = Math.pow(u1, 1 / Math.max(0.0001, a));
  const y = Math.pow(u2, 1 / Math.max(0.0001, b));
  return x / (x + y);
}

// Optional gentle decay so old wins don't dominate forever
function maybeDecay(s: Stats) {
  if (!s.last) return;
  const DAYS = 1000 * 60 * 60 * 24;
  const elapsed = Math.max(0, now() - s.last);
  if (elapsed < 7 * DAYS) return;
  const halfLifeDays = 60;
  const factor = Math.pow(0.5, elapsed / DAYS / halfLifeDays);
  s.a = 1 + (s.a - 1) * factor;
  s.b = 1 + (s.b - 1) * factor;
  s.seen = Math.round(s.seen * factor);
  s.win = Math.round(s.win * factor);
  s.last = now();
}

// --- public API ---

// Seed sibling variants for a base section id (safe to call repeatedly)
export function seedVariants(baseId: string, audience: Audience, siblings: string[]) {
  const db = readDB();
  const key = `${audience}|${baseOf(baseId)}`;
  const pool = Array.from(new Set([baseId, ...siblings]));
  for (const v of pool) ensureArm(db, key, v);
  writeDB(db);
}

// Thompson sample a variant for this audience/base (fallback to original id)
export function pickVariant(id: string, audience: Audience): string {
  const db = readDB();
  const key = `${audience}|${baseOf(id)}`;
  const arms = db[key];
  if (!arms) return id;

  let best = id;
  let bestScore = -Infinity;
  for (const [variant, stats] of Object.entries(arms)) {
    maybeDecay(stats);
    // exploration bonus for cold arms
    const priorMean = stats.a / (stats.a + stats.b);
    const exploration = 0.05 * Math.exp(-Math.min(20, stats.seen) / 6); // fades after ~6–10 trials
    const draw = sampleBeta(stats.a, stats.b) + exploration + priorMean * 0.02;
    if (draw > bestScore) {
      bestScore = draw;
      best = variant;
    }
  }
  return best;
}

// Record outcome for a composed page’s sections.
// We treat every conversion as a win update; seen counts should increase
// out-of-band when you ship (optional), but we still bump seen on wins here.
export function recordSectionOutcome(sections: string[], audience: Audience, win: boolean) {
  if (!Array.isArray(sections) || !sections.length) return;
  const db = readDB();
  for (const fullId of sections) {
    const base = baseOf(fullId);
    const key = `${audience}|${base}`;
    ensureArm(db, key, fullId);
    const st = db[key][fullId];
    st.seen += 1;
    if (win) st.win += 1;
    // Beta update
    if (win) st.a += 1;
    else st.b += 1;
    st.last = now();
  }
  writeDB(db);
}

// --- Minimal bandit counters for metrics/KPI -----------------
// (Named exports expected by router.metrics.ts)

// Separate lightweight store for token-level wins/seen
type TokensCnt = { seen: number; wins: number };
type TokensDB = Record<string, TokensCnt>;

const TOKENS_FILE = path.join(".cache", "bandits.tokens.json");

function readTokenDB(file: string): TokensDB {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}
function writeTokenDB(file: string, db: TokensDB) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db, null, 2), "utf8");
  } catch {
    /* degrade silently */
  }
}

/**
 * Record a "win" for a token (e.g., palette/typography/motif token).
 * Called by KPI routes after a conversion to feed section-level bandits.
 */
export function recordTokenWin(token: string, opts?: { pageId?: string; delta?: number }) {
  if (!token) return;
  const db = readTokenDB(TOKENS_FILE);
  const row = (db[token] ||= { seen: 0, wins: 0 });
  row.wins += Math.max(1, Math.floor(opts?.delta ?? 1));
  writeTokenDB(TOKENS_FILE, db);
}

/** Optional helper to count impressions for a token. */
export function recordTokenSeen(token: string) {
  if (!token) return;
  const db = readTokenDB(TOKENS_FILE);
  const row = (db[token] ||= { seen: 0, wins: 0 });
  row.seen += 1;
  writeTokenDB(TOKENS_FILE, db);
}
