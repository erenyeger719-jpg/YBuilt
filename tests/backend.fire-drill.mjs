// tests/backend.fire-drill.mjs
// Quick-and-dirty "pre-launch fire drill" for platform backend.
// Not a full k6 load test, but enough to shake obvious issues.

const BASE_URL = process.env.BASE_URL || "http://localhost:5050";

async function hit(name, path, options = {}) {
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
    const snippet = text.slice(0, 160).replace(/\s+/g, " ");
    const ok = res.status < 500;

    console.log(`[${name}] ${res.status} in ${ms}ms :: ${snippet}`);
    return { name, status: res.status, ms, ok };
  } catch (err) {
    console.error(
      `[${name}] ERROR: ${err && err.message ? err.message : String(err)}`
    );
    return { name, status: 0, ms: -1, ok: false };
  }
}

async function burst(label, makePathAndOptions, count) {
  const promises = [];
  for (let i = 0; i < count; i++) {
    const { path, options } = makePathAndOptions(i);
    promises.push(hit(`${label}#${i}`, path, options));
  }
  const results = await Promise.all(promises);
  return results;
}

async function main() {
  const allResults = [];

  console.log(
    `[fire-drill] BASE_URL=${BASE_URL} — starting burst against execute + logs...`
  );

  // 1) Execute burst (50 requests)
  allResults.push(
    ...(await burst(
      "execute",
      () => ({
        path: "/api/execute",
        options: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: "for (let i = 0; i < 1000; i++) {} 42;"
          })
        }
      }),
      50
    ))
  );

  // 2) Logs recent burst (20 requests)
  allResults.push(
    ...(await burst(
      "logs-recent",
      () => ({
        path: "/api/logs/recent?limit=500",
        options: {
          method: "GET"
        }
      }),
      20
    ))
  );

  // 3) Logs by-id burst (20 requests)
  allResults.push(
    ...(await burst(
      "logs-by-id",
      (i) => ({
        path: `/api/logs/by-id/fire-drill-${i}`,
        options: {
          method: "GET"
        }
      }),
      20
    ))
  );

  const failed = allResults.filter((r) => !r.ok);
  const byStatus = allResults.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, /** @type {Record<string, number>} */ ({}));

  console.log("[fire-drill] status histogram:", byStatus);

  if (failed.length === 0) {
    console.log("[fire-drill] PASS (no 5xx / network errors in burst)");
    process.exit(0);
  } else {
    console.error("[fire-drill] FAIL (some calls failed):");
    for (const f of failed) {
      console.error(`  - ${f.name} (status=${f.status}, ms=${f.ms})`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[fire-drill] FATAL ERROR:", err);
  process.exit(1);
});
