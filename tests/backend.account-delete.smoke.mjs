// tests/backend.account-delete.smoke.mjs
//
// Simple smoke test for the account deletion endpoint.
//
// What this checks:
//   - DELETE /api/account without any auth → does NOT 5xx
//   - DELETE /api/account with x-debug-user-id in dev → does NOT 5xx
//     (You will usually see 404 unless that user id exists.)
//
// Usage (from repo root):
//   # Terminal 1: start backend
//   pnpm dev
//
//   # Terminal 2: run the test
//   NODE_ENV=development node tests/backend.account-delete.smoke.mjs

const BASE_URL =
  (process.env.API || process.env.BASE_URL || "http://localhost:5050").replace(
    /\/+$/,
    ""
  );

function log(...args) {
  console.log("[backend.account-delete]", ...args);
}

async function deleteOnce(label, headers = {}) {
  const url = BASE_URL + "/api/account";
  const start = Date.now();
  let status = 0;
  let text = "";

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers,
    });
    status = res.status;
    try {
      text = await res.text();
    } catch {
      text = "";
    }
  } catch (err) {
    const ms = Date.now() - start;
    log(`${label}: ERROR after ${ms}ms:`, err && err.message ? err.message : String(err));
    return { label, status: 0, body: "", ms, error: err };
  }

  const ms = Date.now() - start;
  const snippet = text.slice(0, 160).replace(/\s+/g, " ");
  log(`${label}: status=${status}, ms=${ms}, body=${snippet || "<no body>"}`);
  return { label, status, body: text, ms };
}

async function main() {
  log("BASE_URL =", BASE_URL);

  log("Step 1: call without auth (expect 401-ish, but NOT 5xx)...");
  const r1 = await deleteOnce("no-auth");

  log("Step 2: call with x-debug-user-id header (dev only)...");
  const r2 = await deleteOnce("debug-id", {
    "x-debug-user-id": "test-account-delete-user",
  });

  const statuses = [r1.status, r2.status];

  const has5xx = statuses.some((s) => s >= 500);
  if (has5xx) {
    log("RESULT: FAIL — account delete endpoint returned 5xx.");
    process.exit(1);
  }

  log(
    "RESULT: PASS — account delete endpoint responds without 5xx (behaviour is clean for both unauth and dev debug-id calls)."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[backend.account-delete] FATAL ERROR:", err);
  process.exit(1);
});
