// server/sup/ledger.ts
import fs from "fs";
import path from "path";

type Counters = {
  ts: number;             // last update ms
  minute: number;         // sliding minute sum
  burst: number;          // short burst window
  total: number;          // session total
};

type Ledger = Record<string, Counters>;

const FILE = path.join(".cache", "sup.ledger.json");
const BURST_HALF_LIFE_MS = 10_000; // ~10s
const MINUTE_HALF_LIFE_MS = 60_000; // ~60s

const MAX_PER_MIN = parseInt(process.env.SUP_BUDGET_PER_MIN || "60", 10);
const MAX_BURST = parseInt(process.env.SUP_BURST || "15", 10);

function now() { return Date.now(); }
function ensureDir() { try { fs.mkdirSync(".cache", { recursive: true }); } catch {} }

let db: Ledger = {};
try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { db = {}; }

function decay(v: number, dtMs: number, halfLifeMs: number) {
  if (v <= 0) return 0;
  const k = Math.pow(0.5, dtMs / halfLifeMs);
  return v * k;
}

export function keyFor(id?: { ip?: string; session?: string; apiKey?: string }): string {
  return (id?.apiKey || id?.session || id?.ip || "anon").slice(0, 100);
}

export function recordHit(key: string) {
  const t = now();
  const row = db[key] || { ts: t, minute: 0, burst: 0, total: 0 };
  const dt = t - row.ts;

  row.minute = decay(row.minute, dt, MINUTE_HALF_LIFE_MS) + 1;
  row.burst  = decay(row.burst,  dt, BURST_HALF_LIFE_MS)  + 1;
  row.total += 1;
  row.ts = t;

  db[key] = row;
  flushSoon();
  return row;
}

export function checkBudget(key: string): { ok: boolean; remainingMin: number; remainingBurst: number } {
  const row = db[key];
  if (!row) return { ok: true, remainingMin: MAX_PER_MIN, remainingBurst: MAX_BURST };
  const okMin = row.minute <= MAX_PER_MIN;
  const okBurst = row.burst <= MAX_BURST;
  return {
    ok: okMin && okBurst,
    remainingMin: Math.max(0, Math.floor(MAX_PER_MIN - row.minute)),
    remainingBurst: Math.max(0, Math.floor(MAX_BURST - row.burst)),
  };
}

let pending = false;
function flushSoon() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    try {
      ensureDir();
      fs.writeFileSync(FILE, JSON.stringify(db));
    } catch {}
  }, 500);
}
