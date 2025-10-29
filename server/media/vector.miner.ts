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
// --- helpers for content hashing / dedupe ---
function sha1buf(buf: Buffer | string) {
  return crypto.createHash("sha1").update(buf).digest("hex");
}
function fileSha1(p: string) {
  try {
    // Content hash for dedupe across renames/moves
    return sha1buf(fs.readFileSync(p));
  } catch {
    // Fallback to path-based hash if unreadable
    return sha1(p);
  }
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

// Cross-platform, absolute-path-safe version
function relUrl(root: string, abs: string): string | null {
  const rootAbs = path.resolve(root);
  const fileAbs = path.resolve(abs);

  // File must be inside the root
  if (!fileAbs.startsWith(rootAbs + path.sep) && fileAbs !== rootAbs) return null;

  // Consider only web-served roots: .../public or .../static (works cross-platform)
  const served =
    rootAbs.endsWith(`${path.sep}public`) ||
    rootAbs.includes(`${path.sep}public${path.sep}`) ||
    rootAbs.endsWith(`${path.sep}static`) ||
    rootAbs.includes(`${path.sep}static${path.sep}`);

  if (!served) return null;

  const rel = path.relative(rootAbs, fileAbs);
  return "/" + rel.split(path.sep).join("/");
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
  db.assets = db.assets || {};
  db.index = db.index || {};

  let scanned = 0, added = 0;

  for (const rootRaw of ROOTS) {
    const root = path.resolve(rootRaw);
    if (!fs.existsSync(root)) continue;

    const files = walk(root, Math.max(1, maxScan - scanned));
    for (const f of files) {
      scanned++;

      // Path id (legacy) and content id (new canonical)
      const pathId = sha1(f);
      const contentId = fileSha1(f);
      const id = contentId;

      // Migrate legacy path-keyed asset to content-keyed asset
      if (!db.assets[contentId] && db.assets[pathId]) {
        const old = db.assets[pathId];
        db.assets[contentId] = { ...old, id: contentId };
        delete db.assets[pathId];

        // Fix indexes to point to contentId; dedupe entries
        for (const k of Object.keys(db.index)) {
          const arr = db.index[k] || [];
          let changed = false;
          for (let i = 0; i < arr.length; i++) {
            if (arr[i] === pathId) {
              arr[i] = contentId;
              changed = true;
            }
          }
          if (changed) db.index[k] = Array.from(new Set(arr));
        }
      }

      const already = db.assets[id];
      const { tags, industry, vibe } = inferTagsFromPath(f);
      const url = relUrl(root, f);

      const rec = {
        id,
        url: url || null,
        file: f,
        fileHash: contentId,      // new: content hash for durability
        tags,
        industry,
        vibe,
        addedTs: already?.addedTs || Date.now(),
      };

      db.assets[id] = rec;

      // index tags (lowercased), dedup
      const keyset = new Set<string>([...tags, ...vibe, ...industry].map((t) => String(t).toLowerCase()).filter(Boolean));
      for (const k of keyset) {
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
