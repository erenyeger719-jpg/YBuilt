// scripts/db.restore.mjs
// Restore SQLite DB from a backup.
//
// Usage:
//   npm run db:restore              -> restore from latest backup in BACKUP_DIR
//   DB_FILE=./data/app.db DB_BACKUP_DIR=./data/backups node scripts/db.restore.mjs
//   node scripts/db.restore.mjs my-backup-file.db   -> restore from specific file in BACKUP_DIR
//
// WARNING: This overwrites the current DB file (after moving it aside with a .old-<timestamp> suffix).
// Intended for dev/staging and careful prod use.

import fs from "node:fs/promises";
import path from "node:path";

const DB_FILE = process.env.DB_FILE || "./data/app.db";
const BACKUP_DIR = process.env.DB_BACKUP_DIR || "./data/backups";

function makeTimestamp() {
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

async function resolveBackupPath() {
  const arg = process.argv[2];

  if (arg && arg !== "latest") {
    // Explicit filename or path
    if (path.isAbsolute(arg)) {
      return arg;
    }
    return path.join(BACKUP_DIR, arg);
  }

  // No arg or "latest" -> pick newest backup in BACKUP_DIR
  let entries;
  try {
    entries = await fs.readdir(BACKUP_DIR);
  } catch {
    throw new Error(
      `[db:restore] Backup directory not found or unreadable: ${BACKUP_DIR}`
    );
  }

  const baseName = path.basename(DB_FILE).replace(/\.db$/i, "");
  const dbBackups = entries
    .filter((f) => f.startsWith(`${baseName}-`) && f.endsWith(".db"))
    .sort();

  if (dbBackups.length === 0) {
    throw new Error(
      `[db:restore] No backups found in ${BACKUP_DIR} matching ${baseName}-*.db`
    );
  }

  const newest = dbBackups[dbBackups.length - 1];
  return path.join(BACKUP_DIR, newest);
}

async function main() {
  console.log(`[db:restore] DB_FILE=${DB_FILE}`);
  console.log(`[db:restore] BACKUP_DIR=${BACKUP_DIR}`);

  const backupPath = await resolveBackupPath();
  console.log(`[db:restore] Using backup: ${backupPath}`);

  try {
    await fs.access(backupPath);
  } catch {
    throw new Error(`[db:restore] Backup file does not exist: ${backupPath}`);
  }

  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });

  // Move existing DB aside, if present
  const stamp = makeTimestamp();
  try {
    await fs.access(DB_FILE);
    const oldPath = `${DB_FILE}.old-${stamp}`;
    await fs.rename(DB_FILE, oldPath);
    console.log(`[db:restore] Existing DB moved to ${oldPath}`);
  } catch {
    console.log("[db:restore] No existing DB file to move (fresh restore).");
  }

  await fs.copyFile(backupPath, DB_FILE);
  console.log(`[db:restore] Restored ${DB_FILE} from ${backupPath}`);
  console.log("[db:restore] DONE");
}

main().catch((err) => {
  console.error("[db:restore] FATAL ERROR:", err);
  process.exit(1);
});
