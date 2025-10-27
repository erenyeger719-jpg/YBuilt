// server/design/outcome.priors.ts
import fs from "fs";

const FILE = ".cache/token.priors.json";

type Tone = "minimal" | "playful" | "serious";
type BrandLike = { primary?: string; tone?: string; dark?: boolean };

type Counts = Record<string, number>;
type DB = {
  // wins = conversions
  global: Counts; // key = "primary|tone|dark"
  perSession: Record<string, Counts>;

  // seen = ships/views (negatives = seen - wins)
  seenGlobal?: Counts;
  seenPerSession?: Record<string, Counts>;

  _meta?: { lastDecayTs?: number }; // for time-based decay
};

function read(): DB {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { global: {}, perSession: {}, seenGlobal: {}, seenPerSession: {}, _meta: {} };
  }
}
function write(db: DB) {
  try {
    fs.mkdirSync(".cache", { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  } catch {}
}

function normHex(x?: string) {
  if (!x) return undefined;
  const s = String(x).trim().toLowerCase();
  const h = s.startsWith("#") ? s : `#${s}`;
  const ok = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h);
  return ok ? h : undefined; // strictly learn only valid hex colors
}
function normTone(t?: string): Tone | undefined {
  const v = String(t || "").toLowerCase();
  if (v === "minimal" || v === "playful" || v === "serious") return v as Tone;
  return undefined;
}
function key(b: BrandLike) {
  const p = normHex(b.primary) || "";
  const t = normTone(b.tone) || "";
  const d = typeof b.dark === "boolean" ? String(Boolean(b.dark)) : "";
  if (!p && !t && d === "") return ""; // avoid empty combos
  return `${p}|${t}|${d}`;
}
function parseKey(k: string): BrandLike {
  const [p, t, d] = k.split("|");
  return {
    primary: p || undefined,
    tone: (t as Tone) || undefined,
    dark: d === "" ? undefined : d === "true",
  };
}

function inc(map: Counts, k: string, by = 1) {
  map[k] = (map[k] || 0) + by;
}
function ensureSeen(db: DB) {
  db.seenGlobal ||= {};
  db.seenPerSession ||= {};
  db._meta ||= {};
}

// --- decay: half-life based, applied lazily once/day ---
function decayMap(map: Counts, factor: number) {
  for (const k of Object.keys(map)) {
    const v = map[k] * factor;
    if (v < 0.01) delete map[k];
    else map[k] = v;
  }
}
function decayIfNeeded(db: DB, now = Date.now()) {
  ensureSeen(db);
  const last = db._meta!.lastDecayTs || 0;
  if (!last) {
    db._meta!.lastDecayTs = now;
    return; // avoid first-run mass decay
  }
  const DAY = 24 * 60 * 60 * 1000;
  if (now - last < DAY) return;
  const days = Math.max(1, Math.floor((now - last) / DAY));
  const halfLifeDays = 30; // gentle memory
  const factor = Math.pow(0.5, days / halfLifeDays);

  decayMap(db.global, factor);
  decayMap(db.seenGlobal!, factor);
  for (const id of Object.keys(db.perSession)) decayMap(db.perSession[id], factor);
  for (const id of Object.keys(db.seenPerSession!)) decayMap(db.seenPerSession![id], factor);

  db._meta!.lastDecayTs = now;
}

// --- TasteNet-lite (counts + priors) ---
// { "<hex>|<dark>|<tone>": { seen:number, win:number, goodSeen?:number, goodWin?:number, ts:number } }
const TASTE_EVENTS = ".cache/taste.events.json";
const TASTE_PRIORS = ".cache/taste.priors.json"; // { bias: {primary?:string, dark?:boolean, tone?:string}, top: Array<[key,score,seen,win]> }
const TASTE_LAST = ".cache/taste.last.json";

function readJson(p: string, def: any) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return def;
  }
}
function writeJson(p: string, v: any) {
  try {
    fs.mkdirSync(".cache", { recursive: true });
    fs.writeFileSync(p, JSON.stringify(v, null, 2));
  } catch {}
}
function sig(brand: { primary?: string; dark?: boolean; tone?: string }) {
  return `${String(brand?.primary || "").toLowerCase()}|${brand?.dark ? "1" : "0"}|${String(
    brand?.tone || ""
  ).toLowerCase()}`;
}
function parseSig(key: string) {
  const [primary, d, tone] = String(key).split("|");
  return { primary, dark: d === "1", tone };
}

// Log a taste event (safe: merges). Optional metrics gate "good" counters.
export function tasteLogEvent(
  kind: "seen" | "win",
  brand: { primary?: string; dark?: boolean; tone?: string },
  metrics?: { a11y?: boolean; cls?: number; lcp_ms?: number }
) {
  if (!brand) return;
  const k = sig(brand);
  const db = readJson(TASTE_EVENTS, {});
  const row = db[k] || { seen: 0, win: 0, goodSeen: 0, goodWin: 0, ts: 0 };

  const good =
    (metrics?.a11y !== false) &&
    (metrics?.cls == null || metrics.cls <= 0.1) &&
    (metrics?.lcp_ms == null || metrics.lcp_ms <= 2500);

  if (kind === "seen") {
    row.seen += 1;
    if (good) row.goodSeen = (row.goodSeen || 0) + 1;
  }
  if (kind === "win") {
    row.win += 1;
    row.seen += 1; // wins imply seen
    if (good) {
      row.goodWin = (row.goodWin || 0) + 1;
      row.goodSeen = (row.goodSeen || 0) + 1;
    }
  }
  row.ts = Date.now();
  db[k] = row;
  writeJson(TASTE_EVENTS, db);
}

// Train tiny priors from GOOD counts (a11y+perf gated); fallback to raw
export function retrainTasteNet(alpha = 1, minSeen = 3) {
  const db = readJson(TASTE_EVENTS, {});
  const goodScored: Array<{ key: string; score: number; seen: number; win: number }> = [];
  const rawScored: Array<{ key: string; score: number; seen: number; win: number }> = [];

  for (const [k, v] of Object.entries<any>(db)) {
    const s = Math.max(0, Number(v.seen || 0));
    const w = Math.max(0, Number(v.win || 0));
    const gs = Math.max(0, Number(v.goodSeen || 0));
    const gw = Math.max(0, Number(v.goodWin || 0));

    if (gs >= minSeen) {
      const score = (gw + alpha) / (gs + 2 * alpha);
      goodScored.push({ key: k, score, seen: gs, win: gw });
    }
    if (s >= minSeen) {
      const score = (w + alpha) / (s + 2 * alpha);
      rawScored.push({ key: k, score, seen: s, win: w });
    }
  }

  const scored = (goodScored.length ? goodScored : rawScored).sort(
    (a, b) => b.score - a.score || b.seen - a.seen
  );

  const top = scored.slice(0, 8);
  const bias = top.length ? parseSig(top[0].key) : {};
  const out = { bias, top: top.map((r) => [r.key, Number(r.score.toFixed(4)), r.seen, r.win]) };
  writeJson(TASTE_PRIORS, out);
  return out;
}

// Read current priors (if any)
function readPriors() {
  return readJson(TASTE_PRIORS, { bias: {}, top: [] });
}

// Record a positive outcome for a shipped palette combo.
export function recordTokenWin(args: {
  brand: BrandLike;
  sessionId?: string;
  metrics?: { a11y?: boolean; cls?: number; lcp_ms?: number };
}) {
  const db = read();
  decayIfNeeded(db);
  const k = key(args.brand);
  if (!k) return;
  inc(db.global, k, 1);
  if (args.sessionId) {
    db.perSession[args.sessionId] = db.perSession[args.sessionId] || {};
    inc(db.perSession[args.sessionId], k, 1);
  }
  // hook TasteNet logger with metrics
  try {
    tasteLogEvent("win", args?.brand || {}, args.metrics);
  } catch {}
  write(db);
}

// Record a view/ship (used to learn negatives implicitly = seen - wins).
export function recordTokenSeen(args: {
  brand: BrandLike;
  sessionId?: string;
  metrics?: { a11y?: boolean; cls?: number; lcp_ms?: number };
}) {
  const db = read();
  decayIfNeeded(db);
  ensureSeen(db);
  const k = key(args.brand);
  if (!k) return;
  inc(db.seenGlobal!, k, 1);
  if (args.sessionId) {
    db.seenPerSession![args.sessionId] = db.seenPerSession![args.sessionId] || {};
    inc(db.seenPerSession![args.sessionId], k, 1);
  }
  // hook TasteNet logger with metrics
  try {
    tasteLogEvent("seen", args?.brand || {}, args.metrics);
  } catch {}
  write(db);
}

// Return soft biases for a session (fallback to global).
// Score = Bayesian mean: (wins + 1) / (seen + 2)
export function tokenBiasFor(sessionId: string): BrandLike {
  const db = read();
  ensureSeen(db);

  const pickTopRate = (wins: Counts, seen: Counts): string | null => {
    const keys = new Set([...Object.keys(wins), ...Object.keys(seen)]);
    let bestKey: string | null = null,
      bestScore = -Infinity;
    for (const k of keys) {
      const w = wins[k] || 0;
      const s = Math.max(seen[k] || 0, w); // guard: seen >= wins
      const score = (w + 1) / (s + 2);
      if (score > bestScore) {
        bestScore = score;
        bestKey = k;
      }
    }
    return bestKey;
  };

  const sessWins = db.perSession[sessionId] || {};
  const sessSeen = db.seenPerSession![sessionId] || {};
  const sessTop =
    Object.keys(sessWins).length || Object.keys(sessSeen).length ? pickTopRate(sessWins, sessSeen) : null;

  let bias: BrandLike = {};
  if (sessTop) bias = parseKey(sessTop);
  else {
    const globalTop =
      Object.keys(db.global).length || Object.keys(db.seenGlobal!).length ? pickTopRate(db.global, db.seenGlobal!) : null;
    if (globalTop) bias = parseKey(globalTop);
    else {
      // fallback for brand-new installs (no seen data yet): previous behavior
      const oldFallback = Object.entries(db.global).sort((a, b) => b[1] - a[1])[0]?.[0];
      bias = oldFallback ? parseKey(oldFallback) : {};
    }
  }

  // Prefer trained priors where our computed bias is missing fields
  try {
    const pri = readPriors()?.bias || {};
    if (pri.primary && !bias.primary) bias.primary = pri.primary;
    if (typeof pri.dark === "boolean" && typeof bias.dark !== "boolean") bias.dark = pri.dark;
    if (pri.tone && !bias.tone) bias.tone = pri.tone;
  } catch {}

  return bias;
}

// Run retrain at most once per ~24h to keep priors fresh (good events only)
export function maybeNightlyRetrain() {
  let last = 0;
  try {
    last = JSON.parse(fs.readFileSync(TASTE_LAST, "utf8"))?.ts || 0;
  } catch {}
  const DAY = 24 * 60 * 60 * 1000;
  if (Date.now() - last < DAY) return { ran: false };
  const out = retrainTasteNet(1, 3);
  try {
    fs.writeFileSync(TASTE_LAST, JSON.stringify({ ts: Date.now() }));
  } catch {}
  return { ran: true, out };
}
