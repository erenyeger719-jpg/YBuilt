// server/scripts/logs.slo-report.ts
//
// SLO-style report from JSONL logs for Ybuilt.
//
// Goal:
//   - Read JSONL log files in LOG_DIR.
//   - Infer basic HTTP metrics: availability, error rates, p95 latency.
//   - Act as an offline "SLO dashboard" you can run on demand.
//
// Usage (from repo root):
//   npx tsx server/scripts/logs.slo-report.ts
//
// Optional env overrides:
//   LOG_DIR=/custom/log/dir
//   LOG_SLO_DAYS=7   // include logs from the last 7 days instead of 1

import fs from "fs";
import path from "path";
import readline from "readline";

function parseIntOrDefault(value: string | undefined, def: number): number {
  if (!value) return def;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function isLogFileName(name: string): boolean {
  // Example: app-2025-11-17.log, app-2025-11-17.jsonl
  return /^app-.*\.(log|jsonl)$/i.test(name);
}

type Metrics = {
  total: number;
  ok2xx3xx: number;
  client4xx: number;
  server5xx: number;
  otherStatus: number;
  durations: number[];
};

function createEmptyMetrics(): Metrics {
  return {
    total: 0,
    ok2xx3xx: 0,
    client4xx: 0,
    server5xx: 0,
    otherStatus: 0,
    durations: [],
  };
}

function pickNumber(obj: any, candidates: string[]): number | undefined {
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const v = obj[key];
      const n = typeof v === "string" ? Number(v) : v;
      if (typeof n === "number" && Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function classifyStatus(status: number, metrics: Metrics) {
  if (status >= 200 && status <= 399) {
    metrics.ok2xx3xx++;
  } else if (status >= 400 && status <= 499) {
    metrics.client4xx++;
  } else if (status >= 500 && status <= 599) {
    metrics.server5xx++;
  } else {
    metrics.otherStatus++;
  }
}

function recordFromEntry(entry: any, metrics: Metrics) {
  const status = pickNumber(entry, ["status", "statusCode", "httpStatus"]);
  if (status === undefined) {
    return; // not a request-style log or missing status; ignore
  }

  metrics.total++;
  classifyStatus(status, metrics);

  const duration =
    pickNumber(entry, ["durationMs", "latencyMs", "timeMs", "ms"]) ?? undefined;
  if (duration !== undefined && duration >= 0) {
    metrics.durations.push(duration);
  }
}

async function processLogFile(fullPath: string, metrics: Metrics) {
  const stream = fs.createReadStream(fullPath, { encoding: "utf8" });

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Not JSON; skip.
      continue;
    }

    recordFromEntry(parsed, metrics);
  }
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

async function main() {
  const cwd = process.cwd();

  const defaultLogDir = path.join(cwd, "data", "logs");
  const logDir = process.env.LOG_DIR || defaultLogDir;

  const sloDays = parseIntOrDefault(process.env.LOG_SLO_DAYS, 1);
  const now = Date.now();
  const windowMs = sloDays * 24 * 60 * 60 * 1000;

  console.log("[logs.slo-report] cwd       =", cwd);
  console.log("[logs.slo-report] LOG_DIR   =", logDir);
  console.log("[logs.slo-report] SLO_DAYS  =", sloDays);

  if (!fs.existsSync(logDir)) {
    console.log(
      "[logs.slo-report] LOG_DIR does not exist; nothing to report. (OK for fresh installs.)"
    );
    return;
  }

  const entries = fs.readdirSync(logDir, { withFileTypes: true });
  const metrics = createEmptyMetrics();

  let filesConsidered = 0;
  let filesSkipped = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!isLogFileName(entry.name)) continue;

    const fullPath = path.join(logDir, entry.name);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      console.warn(
        "[logs.slo-report] WARN: could not stat file, skipping:",
        fullPath,
        String(err)
      );
      continue;
    }

    const ageMs = now - stat.mtimeMs;
    if (ageMs > windowMs) {
      filesSkipped++;
      continue;
    }

    filesConsidered++;
    console.log("[logs.slo-report] scanning:", entry.name);

    try {
      await processLogFile(fullPath, metrics);
    } catch (err) {
      console.warn(
        "[logs.slo-report] WARN: failed to process file:",
        fullPath,
        String(err)
      );
    }
  }

  console.log("[logs.slo-report] files considered:", filesConsidered);
  console.log("[logs.slo-report] files skipped   :", filesSkipped);

  if (metrics.total === 0) {
    console.log(
      "[logs.slo-report] No request-style log entries found in the selected window."
    );
    console.log("[logs.slo-report] DONE");
    return;
  }

  const availability = metrics.ok2xx3xx / metrics.total;
  const errorRate5xx = metrics.server5xx / metrics.total;

  const p95 = percentile(metrics.durations, 0.95);
  const p50 = percentile(metrics.durations, 0.5);

  console.log("------------------------------------------------------------");
  console.log("SLO SUMMARY (approximate, from logs)");
  console.log("------------------------------------------------------------");
  console.log("Total requests     :", metrics.total);
  console.log("2xx/3xx (OK)       :", metrics.ok2xx3xx);
  console.log("4xx (client error) :", metrics.client4xx);
  console.log("5xx (server error) :", metrics.server5xx);
  console.log("Other status       :", metrics.otherStatus);
  console.log("Availability (2xx/3xx over total) :", formatPercent(availability));
  console.log("5xx error rate                     :", formatPercent(errorRate5xx));
  if (p50 !== null) {
    console.log("p50 latency (ms)   :", p50.toFixed(2));
  } else {
    console.log("p50 latency (ms)   : N/A (no duration data)");
  }
  if (p95 !== null) {
    console.log("p95 latency (ms)   :", p95.toFixed(2));
  } else {
    console.log("p95 latency (ms)   : N/A (no duration data)");
  }
  console.log("Duration samples   :", metrics.durations.length);
  console.log("------------------------------------------------------------");
  console.log("[logs.slo-report] DONE");
}

main().catch((err) => {
  console.error("[logs.slo-report] FATAL ERROR", err);
  process.exit(1);
});
