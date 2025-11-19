// tests/backend.load-core.mjs
// Simple backend load test for core platform endpoints.
// Focuses on /api/execute and /api/logs/*.
//
// Usage:
//   BASE_URL=http://localhost:5050 npm run load:backend:core

import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL || "http://localhost:5050";

async function requestJson(path, init = {}) {
  const url = BASE_URL + path;
  const start = Date.now();
  const res = await fetch(url, {
    ...init
  });
  const ms = Date.now() - start;
  const text = await res.text();

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // leave as null
  }

  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} for ${path}: ${text.slice(0, 200)}`
    );
  }
  if (!json || typeof json !== "object") {
    throw new Error(
      `Non-JSON response for ${path}: ${text.slice(0, 100)}`
    );
  }

  return { json, ms };
}

function p95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.95 * (sorted.length - 1));
  return sorted[idx];
}

async function burst(label, count, fn) {
  console.log(`[load] ${label}: starting ${count} requests`);
  const durations = [];
  let failures = 0;

  await Promise.all(
    Array.from({ length: count }, () =>
      (async () => {
        const t0 = Date.now();
        try {
          await fn();
          durations.push(Date.now() - t0);
        } catch (err) {
          failures++;
          console.error(
            `[load] ${label}: error`,
            err && err.message ? err.message : err
          );
        }
      })()
    )
  );

  if (failures > 0) {
    throw new Error(
      `[load] ${label}: ${failures}/${count} requests failed`
    );
  }

  const max = durations.reduce((m, v) => Math.max(m, v), 0);
  const p95v = p95(durations);

  console.log(
    `[load] ${label}: ok=${count} p95=${p95v.toFixed(
      1
    )}ms max=${max.toFixed(1)}ms`
  );
}

async function main() {
  console.log(`[load] BASE_URL=${BASE_URL}`);

  // 1) /api/execute/health burst (tagged as pro to bypass quotas)
  await burst("execute.health", 50, async () => {
    const { json } = await requestJson("/api/execute/health", {
      headers: {
        "x-plan": "pro"
      }
    });
    assert.ok(json);
    // If there is an "ok" flag, make sure it's not explicitly false.
    if (Object.prototype.hasOwnProperty.call(json, "ok")) {
      assert.notEqual(json.ok, false);
    }
  });

  // 2) /api/execute burst with a tiny snippet (also tagged as pro)
  await burst("execute.simple", 50, async () => {
    const body = JSON.stringify({
      code: "console.log('ybuilt backend load test'); 21 + 21;"
    });
    const { json } = await requestJson("/api/execute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-plan": "pro"
      },
      body
    });
    assert.ok(json);
    if (Object.prototype.hasOwnProperty.call(json, "status")) {
      // We treat "status" === "error" as a failure.
      assert.notEqual(json.status, "error");
    }
  });

  // 3) /api/logs/recent burst, capture one sample log id if available
  let sampleLogId = null;
  await burst("logs.recent", 20, async () => {
    const { json } = await requestJson("/api/logs/recent?limit=20");
    assert.ok(json);
    const items = Array.isArray(json.items) ? json.items : [];
    if (!sampleLogId && items.length > 0) {
      const first = items[0];
      sampleLogId =
        first?.requestId || first?.id || null;
    }
  });

  // 4) /api/logs/by-id/:id burst (only if we found an id)
  if (sampleLogId) {
    const path = `/api/logs/by-id/${encodeURIComponent(
      String(sampleLogId)
    )}`;
    await burst("logs.by-id", 20, async () => {
      const { json } = await requestJson(path);
      assert.ok(json);
      if (Object.prototype.hasOwnProperty.call(json, "ok")) {
        assert.notEqual(json.ok, false);
      }
    });
  } else {
    console.log("[load] logs.by-id skipped (no sample log id found)");
  }

  console.log("[load] backend core load test DONE");
}

main().catch((err) => {
  console.error("[load] FATAL ERROR", err);
  process.exit(1);
});
