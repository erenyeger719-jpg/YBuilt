// scripts/logs.gc.mjs
// Simple log retention / garbage collector.
// Deletes files in LOG_DIR older than LOG_TTL_DAYS (default 60 days).
//
// Usage:
//   npm run logs:gc
//   LOG_DIR=./data/logs LOG_TTL_DAYS=30 node scripts/logs.gc.mjs

import fs from "node:fs/promises";
import path from "node:path";

const LOG_DIR = process.env.LOG_DIR || "./data/logs";
const TTL_DAYS = Number.parseInt(process.env.LOG_TTL_DAYS || "60", 10);

if (!Number.isFinite(TTL_DAYS) || TTL_DAYS <= 0) {
  console.error(
    `[logs:gc] Invalid LOG_TTL_DAYS=${process.env.LOG_TTL_DAYS}, must be positive integer`
  );
  process.exit(1);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_MS = TTL_DAYS * DAY_MS;

async function main() {
  console.log(`[logs:gc] LOG_DIR=${LOG_DIR}`);
  console.log(`[logs:gc] TTL_DAYS=${TTL_DAYS}`);

  let entries;
  try {
    entries = await fs.readdir(LOG_DIR);
  } catch (err) {
    console.error(
      `[logs:gc] ERROR: cannot read LOG_DIR=${LOG_DIR}:`,
      err && err.message ? err.message : String(err)
    );
    process.exit(1);
  }

  const now = Date.now();
  let kept = 0;
  let deleted = 0;

  for (const name of entries) {
    const full = path.join(LOG_DIR, name);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      console.warn(`[logs:gc] Skipping unreadable path: ${full}`);
      continue;
    }

    if (!stat.isFile()) {
      // Ignore directories, sockets, etc.
      continue;
    }

    const ageMs = now - stat.mtimeMs;
    if (ageMs > TTL_MS) {
      try {
        await fs.unlink(full);
        deleted++;
        console.log(
          `[logs:gc] Deleted ${full} (age ${(ageMs / DAY_MS).toFixed(1)} days)`
        );
      } catch (err) {
        console.warn(
          `[logs:gc] Failed to delete ${full}:`,
          err && err.message ? err.message : String(err)
        );
      }
    } else {
      kept++;
    }
  }

  console.log(
    `[logs:gc] DONE — kept ${kept} recent file(s), deleted ${deleted} old file(s)`
  );
}

main().catch((err) => {
  console.error("[logs:gc] FATAL ERROR:", err);
  process.exit(1);
});
