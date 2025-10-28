// server/media/vector.lib.ts
import fs from "fs";
import path from "path";

const FILE = path.resolve(".cache/vector.lib.json");

type Brand = { primary?: string; tone?: string; dark?: boolean };
type Entry = { url: string; brand: Brand; ts: number; uses: number };

function load(): Record<string, Entry> {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return {}; }
}
function save(db: Record<string, Entry>) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  } catch {}
}

function keyFor(url: string) { return String(url).slice(0, 1024); }
function looksVector(v: string) {
  const s = String(v || "");
  return s.startsWith("<svg") || /\.svg(\?|$)/i.test(s) || s.startsWith("data:image/svg+xml");
}

// --- Tiny built-in seed set (SVGs are intentionally small) ---
const SEED_SVGS: Array<{ url: string; brand: Brand }> = [
  {
    url: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="24" rx="4" stroke="currentColor" stroke-width="2"/><path d="M10 28h28" stroke="currentColor" stroke-width="2"/><circle cx="34" cy="22" r="2" fill="currentColor"/></svg>`,
    brand: { tone: "minimal", dark: false, primary: "#6d28d9" },
  },
  {
    url: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="14" stroke="currentColor" stroke-width="2"/><path d="M24 10v8M24 30v8M10 24h8M30 24h8" stroke="currentColor" stroke-width="2"/></svg>`,
    brand: { tone: "serious", dark: false, primary: "#0ea5e9" },
  },
  {
    url: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 48 48" fill="none"><path d="M8 32l16-16 16 16" stroke="currentColor" stroke-width="2" fill="none"/><rect x="6" y="14" width="36" height="22" rx="4" stroke="currentColor" stroke-width="2"/></svg>`,
    brand: { tone: "minimal", dark: true, primary: "#a78bfa" },
  },
  {
    url: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 48 48" fill="none"><rect x="10" y="10" width="28" height="28" rx="6" stroke="currentColor" stroke-width="2"/><path d="M16 24h16" stroke="currentColor" stroke-width="2"/></svg>`,
    brand: { tone: "serious", dark: true, primary: "#10b981" },
  },
  {
    url: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 48 48" fill="none"><path d="M12 30c4-8 20-8 24 0" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="20" r="2" fill="currentColor"/><circle cx="30" cy="20" r="2" fill="currentColor"/></svg>`,
    brand: { tone: "playful", dark: false, primary: "#ef4444" },
  },
  {
    url: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 48 48" fill="none"><path d="M8 30l8-12 8 10 8-8 8 12" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
    brand: { tone: "playful", dark: true, primary: "#f59e0b" },
  },
];

// Bootstrap seeds on first use
(function bootstrapSeeds() {
  try {
    const db = load();
    const count = Object.keys(db).length;
    if (count >= 6) return;
    for (const s of SEED_SVGS) {
      const id = keyFor(s.url);
      if (!db[id]) db[id] = { url: s.url, brand: s.brand, ts: Date.now(), uses: 0 };
    }
    save(db);
  } catch {}
})();

export function rememberVectorAssets(input: { copy: Record<string, string>, brand?: Brand }) {
  const copy = input?.copy || {};
  const brand = input?.brand || {};
  const db = load();

  for (const k of Object.keys(copy)) {
    const val = String(copy[k] ?? "");
    if (!val) continue;
    if (looksVector(val)) {
      const id = keyFor(val);
      const cur = db[id] || { url: val, brand: { primary: brand.primary, tone: brand.tone, dark: brand.dark }, ts: Date.now(), uses: 0 };
      cur.uses += 1;
      cur.ts = Date.now();
      db[id] = cur;
    }
  }
  save(db);
}

// Simple popularity + brand-compat selection
export function suggestVectorAssets(input: { brand?: Brand; limit?: number }) {
  const brand = input?.brand || {};
  const limit = Math.max(1, Math.min(8, Number(input?.limit || 3)));
  const db = load();
  const items = Object.values(db);

  const score = (e: Entry) => {
    let s = e.uses;
    if (typeof brand.dark === "boolean" && e.brand && typeof e.brand.dark === "boolean" && e.brand.dark === brand.dark) s += 2;
    if (brand.tone && e.brand?.tone === brand.tone) s += 1;
    // naive primary proximity: first 2 hex chars match
    if (brand.primary && e.brand?.primary && String(brand.primary).slice(1,3) === String(e.brand.primary).slice(1,3)) s += 1;
    return s;
  };

  items.sort((a, b) => score(b) - score(a));

  const picks = items.slice(0, limit).map(e => e.url);

  const patch: Record<string, string> = {};
  if (picks[0]) patch.ILLUSTRATION_HERO = picks[0];
  if (picks[1]) patch.ICON_PRIMARY = picks[1];
  if (picks[2]) patch.ICON_SECONDARY = picks[2];

  return { copyPatch: patch, from: "vector.lib", picks, total: items.length };
}

/** --------- Simple “miner” (reads retrieval DB and feeds the library) ---------- */
function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${(d.getUTCMonth()+1).toString().padStart(2,"0")}-${d.getUTCDate().toString().padStart(2,"0")}`;
}
export function mineRetrievalDB(limit = 1000) {
  try {
    const RETR_PATH = path.resolve(".cache/retrieval.jsonl");
    const META_PATH = path.resolve(".cache/vector.miner.meta.json");
    if (!fs.existsSync(RETR_PATH)) return { ok: true, scanned: 0, added: 0, note: "no_db" };

    const meta = (() => { try { return JSON.parse(fs.readFileSync(META_PATH, "utf8")); } catch { return { lines_done: 0, last_run_day: "" }; } })();
    const raw = fs.readFileSync(RETR_PATH, "utf8").split(/\r?\n/).filter(Boolean);
    const start = Math.max(0, Math.min(meta.lines_done || 0, raw.length));
    const end = Math.min(raw.length, start + Math.max(1, limit));

    let scanned = 0, added = 0;
    for (let i = start; i < end; i++) {
      scanned++;
      try {
        const j = JSON.parse(raw[i]);
        const payload = j?.data || j?.example || j || {};
        const copy = payload.copy || null;
        const brand = payload.brand || null;
        if (copy && brand) { rememberVectorAssets({ copy, brand }); added++; }
      } catch { /* skip */ }
    }

    meta.lines_done = end;
    meta.last_run_day = todayKey();
    try { fs.mkdirSync(path.dirname(META_PATH), { recursive: true }); fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2)); } catch {}
    return { ok: true, scanned, added };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "miner_failed" };
  }
}
export function maybeNightlyMine() {
  try {
    const META_PATH = path.resolve(".cache/vector.miner.meta.json");
    const meta = (() => { try { return JSON.parse(fs.readFileSync(META_PATH, "utf8")); } catch { return { lines_done: 0, last_run_day: "" }; } })();
    const today = todayKey();
    if (meta.last_run_day === today) return { ok: true, skipped: true };
    return mineRetrievalDB(1000);
  } catch (e) {
    return { ok: false, error: (e as Error).message || "nightly_failed" };
  }
}
