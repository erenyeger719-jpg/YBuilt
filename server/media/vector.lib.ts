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
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); } catch {}
}
function keyFor(url: string) { return String(url).slice(0, 1024); }
function looksVector(v: string) {
  const s = String(v || "");
  return s.startsWith("<svg") || /\.svg(\?|$)/i.test(s) || s.startsWith("data:image/svg+xml");
}

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

  // Patch shape: suggest defaults only if missing
  const patch: Record<string, string> = {};
  if (picks[0]) patch.ILLUSTRATION_HERO = picks[0];
  if (picks[1]) patch.ICON_PRIMARY = picks[1];
  if (picks[2]) patch.ICON_SECONDARY = picks[2];

  return { copyPatch: patch, from: "vector.lib", picks, total: items.length };
}
