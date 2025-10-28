// server/media/vector.lib.ts
// Vector library: tiny synonym-aware suggester + usage memory.
// Stores to .cache/vector.lib.json and prefers existing library assets before synth.
// API used by router: suggestVectorAssets(), rememberVectorAssets()

import fs from "fs";
import path from "path";

type Asset = {
  id: string;
  url: string | null;        // null if not web-served (kept for future)
  file?: string;             // absolute path, for debug
  tags: string[];            // core tags (e.g., analytics, security)
  vibe?: string[];           // style cues: minimal, outline, playful
  industry?: string[];       // saas, ecommerce, portfolio, edu, agency
  addedTs?: number;
};

type LibDB = {
  assets: Record<string, Asset>;
  index: Record<string, string[]>;  // tag -> assetIds
  usage: Record<string, number>;    // assetId -> count
  synonyms: Record<string, string[]>;
  _meta?: { lastMineTs?: number };
};

const FILE = path.resolve(".cache/vector.lib.json");

function load(): LibDB {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {
      assets: {},
      index: {},
      usage: {},
      synonyms: DEFAULT_SYNONYMS,
      _meta: {},
    };
  }
}
function save(db: LibDB) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  } catch {}
}

const DEFAULT_SYNONYMS: Record<string, string[]> = {
  analytics: ["chart", "charts", "graph", "graphs", "dashboard", "metrics", "plot"],
  security:  ["shield", "lock", "locks", "padlock", "secure", "privacy", "guard", "safe"],
  speed:     ["rocket", "bolt", "fast", "performance", "lightning"],
  cloud:     ["cloud", "server", "servers", "network"],
  ai:        ["brain", "neural", "spark", "circuit"],
  code:      ["brackets", "terminal", "console", "dev", "developer"],
  design:    ["brush", "pen", "palette", "layout", "grid"],
  payment:   ["card", "rupee", "money", "wallet", "checkout", "invoice"],
  people:    ["team", "user", "users", "avatar", "group", "community"],
  education: ["book", "books", "learn", "learning", "graduation", "cap", "edu"],
  support:   ["chat", "message", "help", "lifebuoy", "support"],
  ecommerce: ["bag", "cart", "store", "shop", "ecom"],
  portfolio: ["work", "case", "gallery", "folio"],
  agency:    ["brief", "proposal", "client", "agency"],
  // vibes (style cues)
  minimal:   ["line", "outline", "mono", "simple"],
  playful:   ["blob", "rounded", "fun", "color"],
  serious:   ["sharp", "solid", "mono"],
};

function unique<T>(arr: T[]) { return Array.from(new Set(arr)); }

function expandTagsWithSynonyms(db: LibDB, tags: string[]): string[] {
  const out = new Set<string>();
  for (const tRaw of tags) {
    const t = String(tRaw || "").toLowerCase().trim();
    if (!t) continue;
    out.add(t);
    const syn = db.synonyms[t];
    if (Array.isArray(syn)) for (const s of syn) out.add(String(s).toLowerCase());
  }
  return Array.from(out);
}

function deriveQueryFromBrand(brand: any): { tags: string[] } {
  const tone = String(brand?.tone || "").toLowerCase();
  const dark = !!brand?.dark;
  // Start with tone + generic web payload
  const base = ["web", "saas"];
  if (tone === "minimal") base.push("minimal", "outline");
  else if (tone === "playful") base.push("playful", "blob");
  else base.push("serious");
  if (dark) base.push("dark"); // not strictly needed, but harmless filter
  return { tags: base };
}

function scoreAsset(a: Asset, qTags: Set<string>, usage: number): number {
  // Simple scoring: direct tag hits (2x), synonym/prox hits (1x via expand),
  // vibe/industry partials (0.5x), plus a small usage boost.
  let s = 0;
  for (const t of a.tags || []) if (qTags.has(t)) s += 2;
  for (const v of (a.vibe || [])) if (qTags.has(v)) s += 0.5;
  for (const ind of (a.industry || [])) if (qTags.has(ind)) s += 0.5;
  s += Math.log1p(usage) * 0.2;
  // Newer additions get a nudge
  if (a.addedTs) s += Math.min(1, (Date.now() - a.addedTs) / (90 * 24 * 3600_000)) * 0;
  return s;
}

function topNByScore<T>(rows: T[], scoreOf: (t: T) => number, n: number): T[] {
  return rows
    .map((r) => [r, scoreOf(r)] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([r]) => r);
}

// Public: suggest vector assets → copy patch (non-destructive)
export function suggestVectorAssets({ brand = {}, limit = 3 }: { brand?: any; limit?: number }) {
  const db = load();
  const qBase = deriveQueryFromBrand(brand);
  const qExpanded = expandTagsWithSynonyms(db, qBase.tags);
  const qSet = new Set(qExpanded);

  const assets = Object.values(db.assets || {});
  if (!assets.length) return { copyPatch: {} as Record<string, string> };

  const scored = topNByScore(
    assets,
    (a) => scoreAsset(a, qSet, db.usage[a.id] || 0),
    Math.max(1, Math.min(8, limit || 3))
  );

  // Map to copy keys expected by composer (safe if caller ignores)
  const urls = scored.map((a) => a.url).filter(Boolean) as string[];
  const copyPatch: Record<string, string> = {};
  if (urls[0]) copyPatch.HERO_ILLUSTRATION_URL = urls[0];
  if (urls[1]) copyPatch.FEATURES_ICON_1_URL = urls[1];
  if (urls[2]) copyPatch.FEATURES_ICON_2_URL = urls[2];

  return { copyPatch, assets: scored };
}

// Public: remember shipped vectors (tiny learning)
export function rememberVectorAssets({ copy = {}, brand = {} }: { copy?: Record<string, any>; brand?: any }) {
  const db = load();
  const urls: string[] = [];

  // collect any *_URL fields
  for (const [k, v] of Object.entries(copy || {})) {
    if (!/_URL$/i.test(k)) continue;
    const s = String(v || "").trim();
    if (s) urls.push(s);
  }
  if (!urls.length) return { remembered: 0 };

  let bump = 0;
  const byUrl: Record<string, string> = {};
  for (const a of Object.values(db.assets || {})) {
    if (a.url) byUrl[a.url] = a.id;
  }
  for (const u of unique(urls)) {
    const id = byUrl[u];
    if (!id) continue;
    db.usage[id] = (db.usage[id] || 0) + 1;
    bump++;
  }
  if (bump) save(db);
  return { remembered: bump };
}

// Internal helpers for miner to reuse (kept here to avoid duplication)
export function __vectorLib_load() { return load(); }
export function __vectorLib_save(db: LibDB) { return save(db); }
