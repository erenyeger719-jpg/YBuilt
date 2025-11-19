// scripts/db.backup.mjs
// Simple SQLite DB backup helper.
// Uses DB_FILE (default ./data/app.db) and DB_BACKUP_DIR (default ./data/backups).

import fs from "node:fs/promises";
import path from "node:path";

const DB_FILE = process.env.DB_FILE || "./data/app.db";
const BACKUP_DIR = process.env.DB_BACKUP_DIR || "./data/backups";
const MAX_KEEP = Number.parseInt(process.env.DB_BACKUP_KEEP || "30", 10);

function makeTimestamp() {
  // YYYYMMDDHHMMSS (local time, good enough)
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

async function main() {
  console.log(`[db:backup] DB_FILE=${DB_FILE}`);
  console.log(`[db:backup] BACKUP_DIR=${BACKUP_DIR}`);

  try {
    await fs.access(DB_FILE);
  } catch {
    console.error(`[db:backup] ERROR: DB file not found at ${DB_FILE}`);
    process.exit(1);
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const stamp = makeTimestamp();
  const baseName = path.basename(DB_FILE).replace(/\.db$/i, "");
  const backupName = `${baseName}-${stamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  await fs.copyFile(DB_FILE, backupPath);
  console.log(`[db:backup] Copied ${DB_FILE} → ${backupPath}`);

  // Prune old backups: keep newest MAX_KEEP
  try {
    const entries = await fs.readdir(BACKUP_DIR);
    const dbBackups = entries
      .filter((f) => f.startsWith(`${baseName}-`) && f.endsWith(".db"))
      .sort(); // timestamp is part of filename, so lexicographic sort works

    if (dbBackups.length > MAX_KEEP) {
      const toDelete = dbBackups.slice(0, dbBackups.length - MAX_KEEP);
      for (const file of toDelete) {
        const p = path.join(BACKUP_DIR, file);
        await fs.unlink(p);
        console.log(`[db:backup] Pruned old backup ${p}`);
      }
    }

    console.log(
      `[db:backup] Kept ${Math.min(
        dbBackups.length,
        MAX_KEEP
      )} latest backups (MAX_KEEP=${MAX_KEEP})`
    );
  } catch (err) {
    console.warn(
      "[db:backup] Warning while pruning old backups:",
      err && err.message ? err.message : String(err)
    );
  }

  console.log("[db:backup] DONE");
}

main().catch((err) => {
  console.error("[db:backup] FATAL ERROR:", err);
  process.exit(1);
});
