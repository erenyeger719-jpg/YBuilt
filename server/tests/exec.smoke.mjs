// server/tests/exec.smoke.mjs
// Simple smoke test for /api/execute/run.
// Uses the currently running API; does NOT start the server itself.

const base = process.env.API || "http://localhost:5050";

async function main() {
  console.log("🔎 exec smoke: base =", base);

  // 1) Check sandbox health first
  const healthRes = await fetch(`${base}/api/execute/health`);
  const healthJson = await healthRes.json().catch(() => ({}));

  console.log("ℹ️  /api/execute/health =", healthRes.status, healthJson);

  if (!healthJson || healthJson.ok !== true) {
    throw new Error(
      "execute health failed: " + JSON.stringify(healthJson, null, 2)
    );
  }

  if (healthJson.enabled !== true) {
    console.log("⚠️  sandbox is disabled in this environment; skipping exec smoke.");
    process.exit(0);
  }

  // 2) Actually run a tiny job
  const body = {
    lang: "node",
    code: "console.log('hello from exec.smoke');",
    args: [],
  };

  const runRes = await fetch(`${base}/api/execute/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const runJson = await runRes.json().catch(() => ({}));

  console.log("ℹ️  /api/execute/run =", runRes.status, runJson);

  if (!runJson || runJson.ok !== true) {
    throw new Error(
      "exec smoke failed: " + JSON.stringify(runJson, null, 2)
    );
  }

  console.log("✅ exec smoke OK");
}

main().catch((err) => {
  console.error("❌ exec smoke error");
  console.error(err);
  process.exit(1);
});
