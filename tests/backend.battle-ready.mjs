// tests/backend.battle-ready.mjs
//
// Simple "battle ready" smoke + mini load test for the backend.
//
// - Hits /api/execute/health many times in parallel
// - Hits /api/execute with a small code snippet many times
// - Prints success/fail counts and some basic timings
//
// Run with:
//   BASE_URL=http://localhost:5050 node tests/backend.battle-ready.mjs
//
// Assumes Node 20+ (global fetch available).

const BASE_URL = process.env.BASE_URL || "http://localhost:5050";

// How many requests to send in each phase
const HEALTH_RUNS = 30;
const EXEC_RUNS = 30;

// Helper to sleep a bit (if needed)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hitHealthOnce() {
  const url = `${BASE_URL}/api/execute/health`;
  const start = performance.now();
  try {
    const res = await fetch(url);
    const durationMs = performance.now() - start;
    const ok = res.ok;
    let body = null;
    try {
      body = await res.json();
    } catch (_) {
      body = null;
    }
    return {
      ok,
      status: res.status,
      durationMs,
      body,
    };
  } catch (err) {
    const durationMs = performance.now() - start;
    return {
      ok: false,
      status: 0,
      durationMs,
      error: String(err),
    };
  }
}

async function hitExecuteOnce() {
  const url = `${BASE_URL}/api/execute`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: "console.log('hello from battle test'); 1 + 1;",
      }),
    });
    const durationMs = performance.now() - start;
    const ok = res.ok;
    let body = null;
    try {
      body = await res.json();
    } catch (_) {
      body = null;
    }
    return {
      ok,
      status: res.status,
      durationMs,
      body,
    };
  } catch (err) {
    const durationMs = performance.now() - start;
    return {
      ok: false,
      status: 0,
      durationMs,
      error: String(err),
    };
  }
}

function summarize(label, results) {
  const total = results.length;
  const successes = results.filter((r) => r.ok).length;
  const failures = total - successes;

  const durations = results.map((r) => r.durationMs || 0).sort((a, b) => a - b);
  const avg =
    durations.reduce((sum, v) => sum + v, 0) / (durations.length || 1);
  const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
  const p99 = durations[Math.floor(durations.length * 0.99)] || 0;
  const max = durations[durations.length - 1] || 0;

  console.log(`\n=== ${label} ===`);
  console.log(`Total:     ${total}`);
  console.log(`Successes: ${successes}`);
  console.log(`Failures:  ${failures}`);
  console.log(`Avg ms:    ${avg.toFixed(1)}`);
  console.log(`p95 ms:    ${p95.toFixed(1)}`);
  console.log(`p99 ms:    ${p99.toFixed(1)}`);
  console.log(`Max ms:    ${max.toFixed(1)}`);

  if (failures > 0) {
    const sampleFail = results.find((r) => !r.ok);
    console.log(`\nSample failure:`, sampleFail);
  }
}

async function runHealthLoad() {
  console.log(`\n🚦 Health load test → ${HEALTH_RUNS}x /api/execute/health`);
  const promises = [];
  for (let i = 0; i < HEALTH_RUNS; i++) {
    promises.push(hitHealthOnce());
  }
  const results = await Promise.all(promises);
  summarize("Health endpoint", results);
}

async function runExecuteLoad() {
  console.log(`\n🧪 Execute load test → ${EXEC_RUNS}x /api/execute`);
  const promises = [];
  for (let i = 0; i < EXEC_RUNS; i++) {
    promises.push(hitExecuteOnce());
  }
  const results = await Promise.all(promises);
  summarize("Execute endpoint", results);
}

async function main() {
  console.log("YBuilt backend battle-ready check");
  console.log(`BASE_URL = ${BASE_URL}`);

  await runHealthLoad();

  // Tiny pause between phases
  await sleep(500);

  await runExecuteLoad();

  console.log("\n✅ Battle-ready script finished.");
}

main().catch((err) => {
  console.error("❌ Battle-ready script crashed:", err);
  process.exit(1);
});
