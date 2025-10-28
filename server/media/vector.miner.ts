// server/media/vector.miner.ts
// Nightly vector miner: scans local SVG folders, tags files, updates vector.lib.
// Exports: maybeNightlyMine(), runVectorMiner()

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { __vectorLib_load, __vectorLib_save } from "./vector.lib.ts";

const ROOTS = [
  "public",
  "client/public",
  "static",
  "assets/svg",
  "assets/vectors",
];

const INDUSTRY_HINTS: Record<string, string> = {
  saas: "saas",
  ecommerce: "ecommerce",
  ecom: "ecommerce",
  portfolio: "portfolio",
  edu: "education",
  education: "education",
  agency: "agency",
};

const VIBE_HINTS: Record<string, string> = {
  outline: "minimal",
  line: "minimal",
  mono: "minimal",
  minimal: "minimal",
  blob: "playful",
  playful: "playful",
  rounded: "playful",
  solid: "serious",
  sharp: "serious",
};

function sha1(s: string) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}
function walk(dir: string, limit: number, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, limit, acc);
      if (acc.length >= limit) break;
    } else if (e.isFile() && /\.svg$/i.test(e.name)) {
      acc.push(p);
      if (acc.length >= limit) break;
    }
  }
  return acc;
}
function relUrl(root: string, abs: string): string | null {
  // Only roots that are web-served should yield a URL (assume "public" roots are served)
  if (!abs.startsWith(path.resolve(root))) return null;
  const rel = path.relative(path.resolve(root), abs);
  // On web, "public/foo.svg" -> "/foo.svg", "public/vectors/x.svg" -> "/vectors/x.svg"
  if (root.endsWith("public") || root.includes("/public")) return "/" + rel.split(path.sep).join("/");
  if (root.startsWith("static")) return "/" + rel.split(path.sep).join("/");
  return null; // assets/* may not be publicly served
}
function tokenize(name: string): string[] {
  return String(name)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[_\-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function inferTagsFromPath(abs: string): { tags: string[]; industry: string[]; vibe: string[] } {
  const parts = tokenize(abs);
  const tags = new Set<string>();
  const industry = new Set<string>();
  const vibe = new Set<string>();

  for (const p of parts) {
    if (INDUSTRY_HINTS[p]) industry.add(INDUSTRY_HINTS[p]);
    if (VIBE_HINTS[p]) vibe.add(VIBE_HINTS[p]);

    // Common functional tags
    if (["chart", "graph", "dashboard", "metrics", "analytics"].includes(p)) tags.add("analytics");
    if (["shield", "lock", "secure", "security", "privacy", "padlock"].includes(p)) tags.add("security");
    if (["rocket", "speed", "fast", "bolt", "performance"].includes(p)) tags.add("speed");
    if (["cloud", "server", "network"].includes(p)) tags.add("cloud");
    if (["ai", "neural", "brain", "circuit"].includes(p)) tags.add("ai");
    if (["dev", "code", "terminal", "console", "brackets"].includes(p)) tags.add("code");
    if (["shop", "store", "cart", "bag", "ecom", "ecommerce"].includes(p)) tags.add("ecommerce");
    if (["team", "user", "users", "avatar", "community", "group"].includes(p)) tags.add("people");
    if (["book", "edu", "education", "learn", "learning", "cap"].includes(p)) tags.add("education");
    if (["pay", "card", "rupee", "wallet", "checkout", "invoice"].includes(p)) tags.add("payment");
    if (["chat", "message", "help", "support", "lifebuoy"].includes(p)) tags.add("support");

    // Style cues
    if (["outline", "line", "mono", "minimal"].includes(p)) vibe.add("minimal");
    if (["blob", "rounded", "playful"].includes(p)) vibe.add("playful");
    if (["solid", "sharp", "serious"].includes(p)) vibe.add("serious");
  }

  // Defaults if empty
  if (!vibe.size) vibe.add("minimal");
  return { tags: Array.from(tags), industry: Array.from(industry), vibe: Array.from(vibe) };
}

export function runVectorMiner(maxScan = 1000) {
  const db = __vectorLib_load();
  let scanned = 0, added = 0;

  for (const rootRaw of ROOTS) {
    const root = path.resolve(rootRaw);
    if (!fs.existsSync(root)) continue;

    const files = walk(root, Math.max(1, maxScan - scanned));
    for (const f of files) {
      scanned++;
      const id = sha1(f);
      const already = db.assets[id];
      const { tags, industry, vibe } = inferTagsFromPath(f);
      const url = relUrl(root, f);

      const rec = {
        id,
        url: url || null,
        file: f,
        tags,
        industry,
        vibe,
        addedTs: already?.addedTs || Date.now(),
      };

      db.assets[id] = rec;

      // index tags
      for (const t of new Set<string>([...tags, ...vibe, ...industry])) {
        const k = String(t || "").toLowerCase();
        if (!k) continue;
        db.index[k] = db.index[k] || [];
        if (!db.index[k].includes(id)) db.index[k].push(id);
      }

      if (!already) added++;
      if (scanned >= maxScan) break;
    }
    if (scanned >= maxScan) break;
  }

  db._meta = { ...(db._meta || {}), lastMineTs: Date.now() };
  __vectorLib_save(db);
  return { ok: true, scanned, added, total: Object.keys(db.assets).length };
}

export function maybeNightlyMine() {
  const db = __vectorLib_load();
  const last = db._meta?.lastMineTs || 0;
  const DAY = 24 * 3600 * 1000;
  if (Date.now() - last < DAY) return { ok: true, skipped: true, reason: "recent" };
  const out = runVectorMiner(2000);
  return { ok: true, skipped: false, ...out };
}
