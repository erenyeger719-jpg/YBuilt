// tests/db.backup-restore.smoke.mjs
//
// Smoke test for DB backup + restore tooling.
//
// Goal:
//   - Run the SQLite backup script.
//   - Find the latest backup file in ./backups.
//   - Run the restore script in DRY-RUN mode.
//   - Assert that data/app.db.restore-test exists.
//
// Usage (from repo root, server should have been run at least once so data/app.db exists):
//   node tests/db.backup-restore.smoke.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const CWD = process.cwd();
const BACKUPS_DIR = path.join(CWD, "backups");
const DATA_DIR = path.join(CWD, "data");
const RESTORE_TEST_PATH = path.join(DATA_DIR, "app.db.restore-test");

function log(...args) {
  console.log("[db.backup-restore.smoke]", ...args);
}

function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runBackupScript() {
  log("Running db.backup.ts via npx tsx...");
  execFileSync("npx", ["tsx", "server/scripts/db.backup.ts"], {
    stdio: "inherit",
  });
}

function getLatestBackupPath() {
  ensureDirExists(BACKUPS_DIR);
  const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true });

  const candidates = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /^app-.*\.db$/i.test(name));

  assert.ok(
    candidates.length > 0,
    "No app-*.db backup files found in ./backups after running db.backup.ts"
  );

  // Names are of the form app-YYYYMMDD-HHMMSS.db; lexicographic sort matches time.
  candidates.sort();
  const latest = candidates[candidates.length - 1];

  const fullPath = path.join(BACKUPS_DIR, latest);
  log("Latest backup file:", latest);

  return fullPath;
}

function runRestoreDryRun(backupPath) {
  const relative = path.relative(CWD, backupPath);

  log("Running db.restore.ts (DRY RUN) on backup:", relative);
  execFileSync(
    "npx",
    ["tsx", "server/scripts/db.restore.ts", relative],
    { stdio: "inherit" }
  );
}

async function main() {
  log("CWD =", CWD);
  log("BACKUPS_DIR =", BACKUPS_DIR);
  log("DATA_DIR =", DATA_DIR);

  // Step 1: run backup.
  runBackupScript();

  // Step 2: find latest backup.
  const latestBackup = getLatestBackupPath();

  // Step 3: run restore in DRY RUN mode.
  runRestoreDryRun(latestBackup);

  // Step 4: assert restore-test file exists.
  log("Checking for restore-test file:", RESTORE_TEST_PATH);
  const exists = fs.existsSync(RESTORE_TEST_PATH);
  assert.ok(
    exists,
    "Expected data/app.db.restore-test to exist after dry-run restore"
  );

  log("DB backup + dry-run restore SMOKE TEST PASSED ✅");
}

main().catch((err) => {
  console.error("[db.backup-restore.smoke] FATAL ERROR", err);
  process.exit(1);
});
