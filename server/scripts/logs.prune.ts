// server/scripts/logs.prune.ts
//
// Simple log retention / prune helper for Ybuilt.
//
// Goal:
//   - Enforce a basic retention policy on JSONL logs in LOG_DIR.
//   - Default: keep 90 days of logs, delete older files.
//   - This is a building block for a cron / scheduled job.
//
// Usage (from repo root):
//   npx tsx server/scripts/logs.prune.ts
//
// Optional env overrides:
//   LOG_DIR=/custom/log/dir
//   LOG_RETENTION_DAYS=60   // keep 60 days instead of 90

import fs from "fs";
import path from "path";

function parseIntOrDefault(value: string | undefined, def: number): number {
  if (!value) return def;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

// Only delete files that look like real log files, not .gitignore or random junk.
function isLogFileName(name: string): boolean {
  // Example: app-2025-11-17.log, app-2025-11-17.jsonl
  return /^app-.*\.(log|jsonl)$/i.test(name);
}

async function main() {
  const cwd = process.cwd();

  const defaultLogDir = path.join(cwd, "data", "logs");
  const logDir = process.env.LOG_DIR || defaultLogDir;

  const retentionDays = parseIntOrDefault(
    process.env.LOG_RETENTION_DAYS,
    90
  );
  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

  console.log("[logs.prune] cwd        =", cwd);
  console.log("[logs.prune] LOG_DIR    =", logDir);
  console.log("[logs.prune] RETENTION  =", retentionDays, "days");

  if (!fs.existsSync(logDir)) {
    console.log(
      "[logs.prune] LOG_DIR does not exist; nothing to prune. (OK for fresh installs.)"
    );
    return;
  }

  const entries = fs.readdirSync(logDir, { withFileTypes: true });
  let checked = 0;
  let deleted = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!isLogFileName(entry.name)) continue;

    const fullPath = path.join(logDir, entry.name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      console.warn(
        "[logs.prune] WARN: could not stat file, skipping:",
        fullPath,
        String(err)
      );
      continue;
    }

    checked++;
    const ageMs = now - stat.mtimeMs;

    if (ageMs > retentionMs) {
      try {
        fs.unlinkSync(fullPath);
        deleted++;
        console.log("[logs.prune] deleted:", entry.name);
      } catch (err) {
        console.warn(
          "[logs.prune] WARN: failed to delete file:",
          fullPath,
          String(err)
        );
      }
    }
  }

  console.log("[logs.prune] checked files:", checked);
  console.log("[logs.prune] deleted files:", deleted);
  console.log("[logs.prune] DONE");
}

main().catch((err) => {
  console.error("[logs.prune] FATAL ERROR", err);
  process.exit(1);
});
