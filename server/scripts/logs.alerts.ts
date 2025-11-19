// server/scripts/logs.alerts.ts
//
// Lightweight "alert" script driven by JSONL logs for Ybuilt.
//
// Goal:
//   - Read recent JSONL log files in LOG_DIR.
//   - Look at a short window (e.g. last 5 minutes).
//   - Compute:
//       * Availability (2xx/3xx over total)
//       * 5xx error rate
//       * p95 latency for key endpoints (/api/execute, /api/deploy, /api/previews, /api/code)
//       * Quota-exceeded errors
//   - Exit 0 if all within thresholds.
//   - Exit 1 and print reasons if thresholds are breached.
//
// Usage (from repo root, dev):
//   npx tsx server/scripts/logs.alerts.ts
//
// Example for staging/prod:
//   LOG_ALERT_WINDOW_MIN=5 LOG_ALERT_MIN_REQUESTS=50 npx tsx server/scripts/logs.alerts.ts
//
// Env knobs (all optional):
//   LOG_DIR                - default: ./data/logs
//   LOG_ALERT_WINDOW_MIN   - how many minutes back to look (default 5)
//   LOG_ALERT_MIN_REQUESTS - minimum total requests before enforcing SLO (default 50)
//   LOG_ALERT_AVAIL_MIN    - min availability (0..1) over window, default 0.99
//   LOG_ALERT_MAX_5XX_RATE - max allowed 5xx rate (0..1), default 0.01
//   LOG_ALERT_MAX_P95_MS   - max allowed p95 latency in ms for key endpoints, default 700
//   LOG_ALERT_MAX_QUOTA_ERRORS - max quota_exceeded errors in window, default 10

import fs from "fs";
import path from "path";
import readline from "readline";

function parseIntOrDefault(value: string | undefined, def: number): number {
  if (!value) return def;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

function parseFloatOrDefault(value: string | undefined, def: number): number {
  if (!value) return def;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : def;
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

type EndpointMetricsMap = Record<string, Metrics>;

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
      const v = (obj as any)[key];
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

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

async function processLogFile(
  fullPath: string,
  globalMetrics: Metrics,
  endpointMetrics: EndpointMetricsMap,
  counters: { quotaExceeded: number }
) {
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

    // Global metrics (for all /api/*-style requests).
    recordFromEntry(parsed, globalMetrics);

    // Endpoint-specific metrics (based on "path").
    const pathVal = typeof parsed.path === "string" ? parsed.path : undefined;
    if (pathVal && pathVal.startsWith("/api/")) {
      let key = "other";
      if (pathVal.startsWith("/api/execute")) key = "execute";
      else if (pathVal.startsWith("/api/deploy")) key = "deploy";
      else if (pathVal.startsWith("/api/previews")) key = "previews";
      else if (pathVal.startsWith("/api/code")) key = "code";

      if (!endpointMetrics[key]) {
        endpointMetrics[key] = createEmptyMetrics();
      }
      recordFromEntry(parsed, endpointMetrics[key]);
    }

    // Quota errors (if logged as error:"quota_exceeded" or similar).
    const errCode = parsed.error || parsed.err || parsed.code;
    if (errCode === "quota_exceeded") {
      counters.quotaExceeded++;
    }
  }
}

async function main() {
  const cwd = process.cwd();

  const defaultLogDir = path.join(cwd, "data", "logs");
  const logDir = process.env.LOG_DIR || defaultLogDir;

  const windowMin = parseIntOrDefault(process.env.LOG_ALERT_WINDOW_MIN, 5);
  const windowMs = windowMin * 60 * 1000;

  const minRequests = parseIntOrDefault(
    process.env.LOG_ALERT_MIN_REQUESTS,
    50
  );
  const availMin = parseFloatOrDefault(process.env.LOG_ALERT_AVAIL_MIN, 0.99);
  const max5xxRate = parseFloatOrDefault(
    process.env.LOG_ALERT_MAX_5XX_RATE,
    0.01
  );
  const maxP95Ms = parseIntOrDefault(process.env.LOG_ALERT_MAX_P95_MS, 700);
  const maxQuotaErrors = parseIntOrDefault(
    process.env.LOG_ALERT_MAX_QUOTA_ERRORS,
    10
  );

  console.log("[logs.alerts] cwd                =", cwd);
  console.log("[logs.alerts] LOG_DIR            =", logDir);
  console.log("[logs.alerts] WINDOW_MIN         =", windowMin);
  console.log("[logs.alerts] MIN_REQUESTS       =", minRequests);
  console.log("[logs.alerts] AVAIL_MIN          =", availMin);
  console.log("[logs.alerts] MAX_5XX_RATE       =", max5xxRate);
  console.log("[logs.alerts] MAX_P95_MS         =", maxP95Ms);
  console.log("[logs.alerts] MAX_QUOTA_ERRORS   =", maxQuotaErrors);

  if (!fs.existsSync(logDir)) {
    console.log(
      "[logs.alerts] LOG_DIR does not exist; no logs to inspect. Treating as OK."
    );
    process.exit(0);
  }

  const now = Date.now();
  const entries = fs.readdirSync(logDir, { withFileTypes: true });

  const globalMetrics = createEmptyMetrics();
  const endpointMetrics: EndpointMetricsMap = {};
  const counters = { quotaExceeded: 0 };

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
        "[logs.alerts] WARN: could not stat file, skipping:",
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
    console.log("[logs.alerts] scanning:", entry.name);

    try {
      await processLogFile(fullPath, globalMetrics, endpointMetrics, counters);
    } catch (err) {
      console.warn(
        "[logs.alerts] WARN: failed to process file:",
        fullPath,
        String(err)
      );
    }
  }

  console.log("[logs.alerts] files considered   :", filesConsidered);
  console.log("[logs.alerts] files skipped      :", filesSkipped);

  if (globalMetrics.total === 0) {
    console.log(
      "[logs.alerts] No request-style log entries in the window; treating as OK."
    );
    process.exit(0);
  }

  const issues: string[] = [];

  const availability = globalMetrics.ok2xx3xx / globalMetrics.total;
  const server5xxRate = globalMetrics.server5xx / globalMetrics.total;
  const p95Global = percentile(globalMetrics.durations, 0.95);

  console.log("------------------------------------------------------------");
  console.log("ALERT METRICS SUMMARY (approx, from logs)");
  console.log("------------------------------------------------------------");
  console.log("Total requests         :", globalMetrics.total);
  console.log("2xx/3xx (OK)           :", globalMetrics.ok2xx3xx);
  console.log("4xx (client error)     :", globalMetrics.client4xx);
  console.log("5xx (server error)     :", globalMetrics.server5xx);
  console.log("Other status           :", globalMetrics.otherStatus);
  console.log(
    "Availability (2xx/3xx) :", formatPercent(availability),
    `(min ${formatPercent(availMin)})`
  );
  console.log(
    "5xx error rate         :",
    formatPercent(server5xxRate),
    `(max ${formatPercent(max5xxRate)})`
  );
  if (p95Global !== null) {
    console.log("Global p95 latency (ms):", p95Global.toFixed(2));
  } else {
    console.log("Global p95 latency (ms): N/A (no duration data)");
  }
  console.log("Quota-exceeded errors  :", counters.quotaExceeded);
  console.log("------------------------------------------------------------");

  // Check global thresholds (only if enough traffic).
  if (globalMetrics.total >= minRequests) {
    if (availability < availMin) {
      issues.push(
        `Availability ${formatPercent(
          availability
        )} below minimum ${formatPercent(availMin)}`
      );
    }
    if (server5xxRate > max5xxRate) {
      issues.push(
        `5xx error rate ${formatPercent(
          server5xxRate
        )} above maximum ${formatPercent(max5xxRate)}`
      );
    }
  } else {
    console.log(
      `[logs.alerts] Total requests (${globalMetrics.total}) below MIN_REQUESTS (${minRequests}); global SLO checks are informational only.`
    );
  }

  // Endpoint-specific p95 checks for key APIs.
  const importantKeys = ["execute", "deploy", "previews", "code"];
  for (const key of importantKeys) {
    const m = endpointMetrics[key];
    if (!m || m.total === 0) continue;

    const p95 = percentile(m.durations, 0.95);
    if (p95 !== null) {
      console.log(
        `Endpoint p95 latency (ms) [${key}]:`,
        p95.toFixed(2)
      );
      if (p95 > maxP95Ms) {
        issues.push(
          `Endpoint "${key}" p95 latency ${p95.toFixed(
            2
          )}ms above max ${maxP95Ms}ms`
        );
      }
    }
  }

  // Quota-exceeded alerts.
  if (counters.quotaExceeded > maxQuotaErrors) {
    issues.push(
      `Quota errors in window (${counters.quotaExceeded}) exceed max (${maxQuotaErrors})`
    );
  }

  console.log("------------------------------------------------------------");
  if (issues.length === 0) {
    console.log("[logs.alerts] OK (no thresholds breached in window)");
    process.exit(0);
  } else {
    console.error("[logs.alerts] ALERT thresholds breached:");
    for (const msg of issues) {
      console.error("  -", msg);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[logs.alerts] FATAL ERROR", err);
  process.exit(1);
});
