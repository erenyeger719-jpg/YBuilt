// server/scripts/db.restore.ts
//
// SQLite DB restore helper for Ybuilt.
//
// Goal:
//   - Given a backup file, restore it to the primary app DB path.
//   - Default is a SAFE dry-run that writes to app.db.restore-test.
//   - With --commit, it will overwrite data/app.db (after making a safety copy).
//
// Usage (from repo root):
//   Dry run (no overwrite):
//     npx tsx server/scripts/db.restore.ts backups/app-20251117-185753.db
//
//   Commit restore (OVERWRITES data/app.db):
//     npx tsx server/scripts/db.restore.ts backups/app-20251117-185753.db --commit
//
// Optional env overrides:
//   DB_PATH=/custom/path/to/app.db

import fs from "fs";
import path from "path";

function nowTimestamp() {
  const d = new Date();
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

  const args = process.argv.slice(2);
  const backupArg = args[0];
  const commit = args.includes("--commit");

  if (!backupArg) {
    console.error(
      [
        "[db.restore] ERROR: missing backup file argument.",
        "Usage:",
        "  npx tsx server/scripts/db.restore.ts backups/<backup-file>.db",
        "  npx tsx server/scripts/db.restore.ts backups/<backup-file>.db --commit",
      ].join("\n")
    );
    process.exit(1);
  }

  const backupPath = path.isAbsolute(backupArg)
    ? backupArg
    : path.join(cwd, backupArg);

  console.log("[db.restore] cwd      =", cwd);
  console.log("[db.restore] DB_PATH  =", dbPath);
  console.log("[db.restore] BACKUP   =", backupPath);
  console.log("[db.restore] MODE     =", commit ? "COMMIT (overwrite)" : "DRY RUN");

  if (!fs.existsSync(backupPath)) {
    console.error(
      `[db.restore] ERROR: backup file not found at ${backupPath}.`
    );
    process.exit(1);
  }

  const backupStat = fs.statSync(backupPath);
  console.log("[db.restore] backup size =", backupStat.size, "bytes");

  if (!commit) {
    const testPath = dbPath + ".restore-test";
    fs.copyFileSync(backupPath, testPath);
    const statAfter = fs.statSync(testPath);

    console.log("[db.restore] DRY RUN complete.");
    console.log("[db.restore]   wrote:", testPath);
    console.log("[db.restore]   size :", statAfter.size, "bytes");
    console.log(
      "[db.restore] Live DB NOT modified. Re-run with --commit to overwrite data/app.db."
    );
    return;
  }

  // COMMIT mode: make a safety copy of current DB (if it exists), then overwrite.
  const backupsDir = path.join(cwd, "backups");
  fs.mkdirSync(backupsDir, { recursive: true });

  if (fs.existsSync(dbPath)) {
    const ts = nowTimestamp();
    const safetyName = `before-restore-${ts}.db`;
    const safetyPath = path.join(backupsDir, safetyName);

    fs.copyFileSync(dbPath, safetyPath);
    console.log("[db.restore] Safety backup of current DB created:");
    console.log("[db.restore]   ", safetyPath);
  } else {
    console.log(
      "[db.restore] NOTE: DB file does not exist yet at DB_PATH; nothing to back up."
    );
  }

  fs.copyFileSync(backupPath, dbPath);
  const finalStat = fs.statSync(dbPath);

  console.log("[db.restore] RESTORE COMMITTED.");
  console.log("[db.restore]   from:", backupPath);
  console.log("[db.restore]   to  :", dbPath);
  console.log("[db.restore]   size:", finalStat.size, "bytes");
  console.log("[db.restore] DONE");
}

main().catch((err) => {
  console.error("[db.restore] FATAL ERROR", err);
  process.exit(1);
});
