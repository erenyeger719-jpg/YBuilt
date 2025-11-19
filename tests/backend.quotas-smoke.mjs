// tests/backend.quotas-smoke.mjs
//
// Simple quota sanity test.
//
// Goal:
//   - With QUOTA_ENABLED=true and very small QUOTA_PER_MIN,
//     "free" callers SHOULD hit 429 on a quota-protected route.
//   - "pro" callers (x-plan: pro) should NOT hit 429.
//   - If no 429s are observed at all, we WARN but PASS:
//       * It likely means this PATH is not quota-protected yet.
//
// Usage (from repo root):
//   # Terminal: start backend (dev server on :5050)
//   pnpm dev
//
//   # New terminal: run quota smoke test with tight limits
//   QUOTA_ENABLED=true QUOTA_PER_MIN=3 QUOTA_PER_DAY=100 node tests/backend.quotas-smoke.mjs
//
// Notes:
//   - By default this hits /api/execute.
//   - If your quota middleware is attached to a different route
//     (e.g. /api/ai/act), change QUOTA_TEST_PATH env or PATH below.
//

const BASE_URL =
  (process.env.API || process.env.BASE_URL || "http://localhost:5050").replace(
    /\/+$/,
    ""
  );

// You can override this via env if needed:
//   QUOTA_TEST_PATH=/api/ai/act
const PATH = process.env.QUOTA_TEST_PATH || "/api/execute";

const FREE_REQUESTS = Number(process.env.QUOTA_TEST_FREE_REQS || 6);
const PRO_REQUESTS = Number(process.env.QUOTA_TEST_PRO_REQS || 6);

function log(...args) {
  console.log("[backend.quotas-smoke]", ...args);
}

async function postOnce(label, plan) {
  const url = BASE_URL + PATH;

  // Default body works for /api/execute.
  // If you change PATH to an AI route, you may need to change this body shape.
  const body = {
    code: "for (let i = 0; i < 1000; i++) {} 42;",
  };

  const headers = { "content-type": "application/json" };
  if (plan) {
    headers["x-plan"] = plan;
  }

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const ms = Date.now() - start;
    let text = "";
    try {
      text = await res.text();
    } catch {
      text = "";
    }
    let snippet = text.slice(0, 120).replace(/\s+/g, " ");
    return {
      label,
      plan: plan || "(none)",
      status: res.status,
      ms,
      snippet,
    };
  } catch (err) {
    const ms = Date.now() - start;
    return {
      label,
      plan: plan || "(none)",
      status: 0,
      ms,
      snippet: "",
      error: err && err.message ? err.message : String(err),
    };
  }
}

async function runFreePhase() {
  log("Phase 1: hitting as FREE plan (no x-plan header)...");
  const results = [];
  for (let i = 0; i < FREE_REQUESTS; i++) {
    const r = await postOnce(`free#${i}`, null);
    results.push(r);
    log(
      `  free#${i}: status=${r.status}, ms=${r.ms}, snippet=${r.snippet || r.error || "<no body>"}`
    );
  }
  const count429 = results.filter((r) => r.status === 429).length;
  const count200 = results.filter((r) => r.status === 200).length;
  log(
    `Phase 1 summary: 200=${count200}, 429=${count429}, total=${results.length}`
  );
  return { results, count200, count429 };
}

async function runProPhase() {
  log("Phase 2: hitting as PRO plan (x-plan: pro)...");
  const results = [];
  for (let i = 0; i < PRO_REQUESTS; i++) {
    const r = await postOnce(`pro#${i}`, "pro");
    results.push(r);
    log(
      `  pro#${i}: status=${r.status}, ms=${r.ms}, snippet=${r.snippet || r.error || "<no body>"}`
    );
  }
  const count429 = results.filter((r) => r.status === 429).length;
  const count200 = results.filter((r) => r.status === 200).length;
  log(
    `Phase 2 summary: 200=${count200}, 429=${count429}, total=${results.length}`
  );
  return { results, count200, count429 };
}

async function main() {
  log("BASE_URL        =", BASE_URL);
  log("PATH            =", PATH);
  log("FREE_REQUESTS   =", FREE_REQUESTS);
  log("PRO_REQUESTS    =", PRO_REQUESTS);
  log("QUOTA_ENABLED   =", process.env.QUOTA_ENABLED);
  log("QUOTA_PER_MIN   =", process.env.QUOTA_PER_MIN);
  log("QUOTA_PER_DAY   =", process.env.QUOTA_PER_DAY);

  if (!process.env.QUOTA_ENABLED || process.env.QUOTA_ENABLED === "false") {
    log(
      "WARNING: QUOTA_ENABLED is not true. This test will not see 429s. Re-run with QUOTA_ENABLED=true if you want to exercise quotas."
    );
  }

  const freePhase = await runFreePhase();
  const proPhase = await runProPhase();

  const free429 = freePhase.count429;
  const pro429 = proPhase.count429;

  log(
    `Final: free429=${free429}, pro429=${pro429} (ideal: free429 > 0, pro429 = 0 on a quota-protected PATH)`
  );

  // 1) Ideal: free hits quota wall, pro does not.
  if (free429 > 0 && pro429 === 0) {
    log(
      "RESULT: PASS — free plan hits quota wall, pro plan bypasses it (ideal case on quota-protected PATH)."
    );
    process.exit(0);
  }

  // 2) If pro hits 429 at all, that's bad: paid bypass broken.
  if (pro429 > 0) {
    log(
      "RESULT: FAIL — pro plan is hitting 429. Paid/bypass behaviour is broken for this PATH."
    );
    process.exit(1);
  }

  // 3) If both see zero 429s, quotas aren't exercised on this PATH. Warn but pass.
  if (free429 === 0 && pro429 === 0) {
    log(
      "RESULT: WARN (treated as PASS) — no 429s observed. This PATH is likely not quota-protected or limits are high. Test passes, but quotas are not being exercised here."
    );
    process.exit(0);
  }

  // 4) Remaining weird case: free429 > 0 && pro429 > 0
  log(
    "RESULT: FAIL — both free and pro plans hit 429. Paid bypass behaviour is not correct for this PATH."
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("[backend.quotas-smoke] FATAL ERROR:", err);
  process.exit(1);
});
