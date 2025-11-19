// tests/backend.chaos-restart.mjs
//
// Lightweight "chaos / restart" drill for Ybuilt backend.
//
// Goal:
//   - Send continuous traffic to the backend.
//   - While this script runs, YOU manually kill & restart the server process.
//   - Verify that:
//       * Warmup phase is healthy.
//       * During chaos, some errors are tolerated (expected).
//       * After restart, recovery phase is fully healthy again.
//
// Usage (from repo root):
//   # Terminal 1: start your backend (dev server on :5050)
//   pnpm dev
//
//   # Terminal 2: run chaos drill
//   node tests/backend.chaos-restart.mjs
//
//   # While the script is in CHAOS phase, go back to Terminal 1,
//   # kill the server (Ctrl+C), then restart it.
//   # Script will report PASS/FAIL at the end.
//
// Env:
//   API or BASE_URL can be set, otherwise defaults to http://localhost:5050

const BASE_URL =
  (process.env.API || process.env.BASE_URL || "http://localhost:5050").replace(
    /\/+$/,
    ""
  );

const CHAOS_DURATION_MS = Number(process.env.CHAOS_DURATION_MS || 20000); // 20s
const WARMUP_REQUESTS = Number(process.env.WARMUP_REQUESTS || 10);
const RECOVERY_REQUESTS = Number(process.env.RECOVERY_REQUESTS || 20);

function log(...args) {
  console.log("[backend.chaos-restart]", ...args);
}

async function hitOnce(name, path, options = {}) {
  const url = BASE_URL + path;
  const start = Date.now();

  try {
    const res = await fetch(url, options);
    const ms = Date.now() - start;

    let text = "";
    try {
      text = await res.text();
    } catch {
      text = "";
    }
    const snippet = text.slice(0, 120).replace(/\s+/g, " ");

    const is5xx = res.status >= 500 && res.status <= 599;
    return {
      name,
      status: res.status,
      ms,
      ok: !is5xx,
      snippet,
      errorType: is5xx ? "5xx" : null,
    };
  } catch (err) {
    const ms = Date.now() - start;
    return {
      name,
      status: 0,
      ms,
      ok: false,
      snippet: "",
      errorType: "network",
      error: err && err.message ? err.message : String(err),
    };
  }
}

async function hitPair(labelPrefix, idx) {
  // We hit two endpoints: /health and /api/execute
  const executeBody = {
    code: "for (let i = 0; i < 1000; i++) {} 42;",
  };

  const [h, e] = await Promise.all([
    hitOnce(`${labelPrefix}-health#${idx}`, "/health"),
    hitOnce(`${labelPrefix}-execute#${idx}`, "/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(executeBody),
    }),
  ]);

  return [h, e];
}

function summarisePhase(name, results) {
  const total = results.length;
  const failures = results.filter((r) => !r.ok);
  const byStatus = results.reduce((acc, r) => {
    const key = String(r.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, /** @type {Record<string, number>} */ ({}));

  log(`--- ${name} SUMMARY ---`);
  log("Total requests :", total);
  log("Status histogram:", byStatus);
  log("Failures       :", failures.length);
  if (failures.length > 0) {
    for (const f of failures.slice(0, 5)) {
      log(
        `  - ${f.name}: status=${f.status}, ms=${f.ms}, type=${f.errorType || "ok"}, snippet=${f.snippet ||
          f.error ||
          "<no body>"}`
      );
    }
    if (failures.length > 5) {
      log(`  ... and ${failures.length - 5} more failures`);
    }
  }
  log("------------------------");
  return { total, failures, byStatus };
}

async function warmupPhase() {
  log("WARMUP phase: making sure backend is healthy before chaos…");
  const all = [];
  for (let i = 0; i < WARMUP_REQUESTS; i++) {
    const [h, e] = await hitPair("warmup", i);
    all.push(h, e);
  }
  const summary = summarisePhase("WARMUP", all);
  if (summary.failures.length > 0) {
    log(
      "WARMUP FAILED: backend is not healthy even before chaos. Aborting drill."
    );
    return { ok: false, results: all };
  }
  log("WARMUP OK: backend looks healthy. Proceeding to CHAOS phase.");
  return { ok: true, results: all };
}

async function chaosPhase() {
  log("");
  log("------------------------------------------------------------");
  log("CHAOS phase starting.");
  log(
    "While this phase runs (~" +
      CHAOS_DURATION_MS +
      "ms), go to the server terminal, kill the backend, then restart it."
  );
  log("Some network/5xx errors are EXPECTED during chaos.");
  log("------------------------------------------------------------");

  const start = Date.now();
  const all = [];

  let i = 0;
  while (Date.now() - start < CHAOS_DURATION_MS) {
    const [h, e] = await hitPair("chaos", i++);
    all.push(h, e);

    // Log a tiny dot stream:
    if (!h.ok || !e.ok) {
      process.stdout.write("x");
    } else {
      process.stdout.write(".");
    }

    await new Promise((r) => setTimeout(r, 200)); // 5 pairs per second
  }
  process.stdout.write("\n");

  const summary = summarisePhase("CHAOS", all);
  log(
    "CHAOS phase complete. Failures here are informational, not fatal for the drill."
  );
  return { ok: true, results: all, summary };
}

async function recoveryPhase() {
  log("");
  log("RECOVERY phase: backend should be up and healthy again now…");
  const all = [];
  for (let i = 0; i < RECOVERY_REQUESTS; i++) {
    const [h, e] = await hitPair("recovery", i);
    all.push(h, e);
  }
  const summary = summarisePhase("RECOVERY", all);

  if (summary.failures.length > 0) {
    log(
      "RECOVERY FAILED: backend did not fully recover after chaos (some requests still failing)."
    );
    return { ok: false, results: all };
  }

  log("RECOVERY OK: backend is healthy again after chaos.");
  return { ok: true, results: all };
}

async function main() {
  log("BASE_URL       =", BASE_URL);
  log("WARMUP_REQUESTS   =", WARMUP_REQUESTS);
  log("CHAOS_DURATION_MS =", CHAOS_DURATION_MS);
  log("RECOVERY_REQUESTS =", RECOVERY_REQUESTS);

  const warm = await warmupPhase();
  if (!warm.ok) {
    process.exit(1);
  }

  await chaosPhase();

  const rec = await recoveryPhase();
  if (!rec.ok) {
    log(
      "RESULT: FAIL — backend did not recover cleanly after kill/restart. Investigate logs, processes, and health."
    );
    process.exit(1);
  }

  log(
    "RESULT: PASS — backend handled kill/restart while under traffic and recovered cleanly."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[backend.chaos-restart] FATAL ERROR:", err);
  process.exit(1);
});
