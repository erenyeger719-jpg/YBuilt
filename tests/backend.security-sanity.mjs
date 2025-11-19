// tests/backend.security-sanity.mjs
//
// "Security sanity" smoke test for Ybuilt backend.
//
// Goal:
//   - Send obviously hostile / weird inputs to key API endpoints.
//   - Assert the server responds with 4xx (or at worst 2xx/3xx),
//     NOT 5xx and NOT crashing the process.
//
// Usage (from repo root):
//   # Against local dev (default http://localhost:5050)
//   node tests/backend.security-sanity.mjs
//
//   # Against staging / prod
//   API=https://your-api-host node tests/backend.security-sanity.mjs
//
// Exit codes:
//   0 = all tests produced non-5xx responses (no network errors)
//   1 = at least one test hit 5xx or network error

const BASE_URL =
  (process.env.API || process.env.BASE_URL || "http://localhost:5050").replace(
    /\/+$/,
    ""
  );

function log(...args) {
  console.log("[backend.security-sanity]", ...args);
}

/**
 * Individual test case definition.
 * - name: label for logs
 * - method: HTTP method
 * - path: path starting with /api/...
 * - makeBody: optional () => any (for POST/PUT)
 */
const TESTS = [
  // 1) Huge code payload to /api/execute (should 4xx, not 5xx)
  {
    name: "execute-huge-code",
    method: "POST",
    path: "/api/execute",
    makeBody: () => ({
      code: "x".repeat(120_000), // intentionally larger than usual
    }),
  },

  // 2) Code with path traversal-ish content (should be treated as just a string)
  {
    name: "execute-path-traversal-string",
    method: "POST",
    path: "/api/execute",
    makeBody: () => ({
      code: 'require("fs").readFileSync("../../etc/passwd", "utf8");',
    }),
  },

  // 3) Logs recent with traversal-ish query param (should 4xx/2xx, not 5xx)
  {
    name: "logs-recent-path-traversal",
    method: "GET",
    path: "/api/logs/recent?limit=50&foo=../../etc/passwd",
  },

  // 4) Logs by-id with traversal-ish ID (should 4xx/404, not 5xx)
  {
    name: "logs-by-id-path-traversal",
    method: "GET",
    path: "/api/logs/by-id/../../etc/passwd",
  },

  // 5) Nonsense large JSON to a likely-nonexistent route (should 404/4xx, not 5xx)
  {
    name: "unknown-route-large-body",
    method: "POST",
    path: "/api/this-route-should-not-exist",
    makeBody: () => ({
      junk: "z".repeat(80_000),
      arr: Array.from({ length: 2000 }, (_, i) => `item-${i}`),
    }),
  },
];

async function hitOnce(test) {
  const url = BASE_URL + test.path;
  const start = Date.now();

  try {
    const options = { method: test.method, headers: {} };

    if (test.method === "POST" || test.method === "PUT" || test.method === "PATCH") {
      const body =
        typeof test.makeBody === "function" ? test.makeBody() : undefined;
      if (body !== undefined) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
    }

    const res = await fetch(url, options);
    const ms = Date.now() - start;

    let text = "";
    try {
      text = await res.text();
    } catch {
      text = "";
    }
    const snippet = text.slice(0, 160).replace(/\s+/g, " ");

    const is5xx = res.status >= 500 && res.status <= 599;
    const ok = !is5xx;

    console.log(
      `[${test.name}] ${res.status} in ${ms}ms :: ${snippet || "<no body>"}`
    );

    return {
      name: test.name,
      status: res.status,
      ms,
      ok,
    };
  } catch (err) {
    const ms = Date.now() - start;
    console.error(
      `[${test.name}] NETWORK ERROR after ${ms}ms:`,
      err && err.message ? err.message : String(err)
    );
    return {
      name: test.name,
      status: 0,
      ms,
      ok: false,
      error: String(err),
    };
  }
}

async function main() {
  log("BASE_URL =", BASE_URL);
  log("Total tests =", TESTS.length);

  const results = [];
  for (const t of TESTS) {
    log(`Running test: ${t.name} (${t.method} ${t.path})`);
    const r = await hitOnce(t);
    results.push(r);
  }

  // Summarise statuses.
  const byStatus = results.reduce((acc, r) => {
    acc[String(r.status)] = (acc[String(r.status)] || 0) + 1;
    return acc;
  }, /** @type {Record<string, number>} */ ({}));

  const failed = results.filter((r) => !r.ok);

  console.log("------------------------------------------------------------");
  console.log("SECURITY SANITY SUMMARY");
  console.log("------------------------------------------------------------");
  console.log("Status histogram:", byStatus);
  console.log("Failed tests (5xx or network errors):", failed.length);
  if (failed.length > 0) {
    for (const f of failed) {
      console.log(
        `  - ${f.name} (status=${f.status}, ms=${f.ms})`
      );
    }
  }
  console.log("------------------------------------------------------------");

  if (failed.length === 0) {
    console.log(
      "[backend.security-sanity] PASS (no 5xx / network errors for hostile inputs)"
    );
    process.exit(0);
  } else {
    console.error(
      "[backend.security-sanity] FAIL (some tests hit 5xx or network errors)"
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[backend.security-sanity] FATAL ERROR:", err);
  process.exit(1);
});
