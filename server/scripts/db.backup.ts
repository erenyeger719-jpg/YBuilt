// server/scripts/db.backup.ts
//
// Simple SQLite DB backup helper for Ybuilt.
//
// Goal:
//   - Take a point-in-time snapshot of the primary app DB.
//   - Write it into ./backups with a timestamped filename.
//   - This is the building block for cron / Render jobs later.
//
// Usage (from repo root):
//   npx tsx server/scripts/db.backup.ts
//
// Optional env overrides:
//   DB_PATH=/custom/path/to/app.db
//   DB_BACKUP_DIR=/custom/backup/dir

import fs from "fs";
import path from "path";

function nowTimestamp() {
  const d = new Date();
  // YYYYMMDD-HHMMSS
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function main() {
  const cwd = process.cwd();

  const defaultDbPath = path.join(cwd, "data", "app.db");
  const dbPath = process.env.DB_PATH || defaultDbPath;

  const defaultBackupDir = path.join(cwd, "backups");
  const backupDir = process.env.DB_BACKUP_DIR || defaultBackupDir;

  console.log("[db.backup] cwd      =", cwd);
  console.log("[db.backup] DB_PATH  =", dbPath);
  console.log("[db.backup] OUT_DIR  =", backupDir);

  if (!fs.existsSync(dbPath)) {
    console.error(
      `[db.backup] ERROR: DB file not found at ${dbPath}. ` +
        "Check DB_PATH or run the server at least once to create the DB."
    );
    process.exit(1);
  }

  // Ensure backup directory exists.
  fs.mkdirSync(backupDir, { recursive: true });

  const ts = nowTimestamp();
  const baseName = path.basename(dbPath, path.extname(dbPath));
  const backupFile = `${baseName}-${ts}.db`;
  const backupPath = path.join(backupDir, backupFile);

  // Copy the file byte-for-byte.
  const statBefore = fs.statSync(dbPath);
  fs.copyFileSync(dbPath, backupPath);

  const statAfter = fs.statSync(backupPath);

  console.log("[db.backup] OK: backup created");
  console.log("[db.backup]   from:", dbPath);
  console.log("[db.backup]   to  :", backupPath);
  console.log("[db.backup]   size:", statAfter.size, "bytes");

  if (statBefore.size !== statAfter.size) {
    console.warn(
      "[db.backup] WARN: source and backup file sizes differ.",
      "This is unusual for a straight copy; check manually if needed."
    );
  }

  console.log("[db.backup] DONE");
}

main().catch((err) => {
  console.error("[db.backup] FATAL ERROR", err);
  process.exit(1);
});
