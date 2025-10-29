// server/tests/smoke.mjs
// Node 18+ required (has global fetch).
// Usage:
//   # server running locally:
//   node server/tests/smoke.mjs
//   # or point to a deployed base URL:
//   BASE_URL="https://ybuilt1.onrender.com" node server/tests/smoke.mjs

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function req(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}

function now() { return Date.now(); }
function uid() { return Math.random().toString(36).slice(2, 10); }

let PASS = 0, FAIL = 0;
const fails = [];
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅  ${name}`);
    PASS++;
  } catch (e) {
    console.error(`❌  ${name} — ${e.message || e}`);
    FAIL++;
    fails.push(`${name}: ${e.message || e}`);
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async function run() {
  console.log(`\n=== Ybuilt backend smoke (base: ${base}) ===\n`);
  const exp = `smoke_${now()}_${uid()}`;

  // 1) Health check (sandbox/runner presence if mounted)
  await test("GET /api/execute/health responds with ok:true", async () => {
    const r = await req("GET", "/api/execute/health");
    expect(r.status === 200, `status ${r.status}`);
    expect(r.json && r.json.ok === true, "ok !== true");
  });

  // 2) Metrics: empty experiment returns zeros
  await test("GET /api/metrics?experiment=exp returns zeroed A/B", async () => {
    const r = await req("GET", `/api/metrics?experiment=${encodeURIComponent(exp)}`);
    expect(r.status === 200, `status ${r.status}`);
    const exps = r.json.experiments || {};
    expect(exps[exp], "missing experiment key");
    expect(exps[exp].A.views === 0 && exps[exp].B.views === 0, "views not zero");
    expect(exps[exp].A.conv === 0 && exps[exp].B.conv === 0, "conv not zero");
  });

  // 3) KPI/seen — happy path
  await test("POST /api/kpi/seen (A,A,B) then metrics match", async () => {
    const seen = async (variant) =>
      req("POST", "/api/kpi/seen", {
        experiment: exp,
        variant,
        path: "/",
        ts: now(),
      });
    await seen("A"); await seen("A"); await seen("B");

    const r = await req("GET", `/api/metrics?experiment=${encodeURIComponent(exp)}`);
    const m = r.json.experiments[exp];
    expect(m.A.views === 2, `A.views=${m.A.views}, expected 2`);
    expect(m.B.views === 1, `B.views=${m.B.views}, expected 1`);
    expect(m.A.conv === 0 && m.B.conv === 0, "conv should still be 0");
  });

  // 4) KPI/convert — happy path
  await test("POST /api/kpi/convert (A x1) then metrics reflect conv", async () => {
    const r1 = await req("POST", "/api/kpi/convert", {
      experiment: exp,
      variant: "A",
      pageId: "test-page",
      meta: { src: "smoke" },
    });
    expect(r1.status === 200 && r1.json.ok === true, "convert ok !== true");

    const r = await req("GET", `/api/metrics?experiment=${encodeURIComponent(exp)}`);
    const m = r.json.experiments[exp];
    expect(m.A.conv === 1, `A.conv=${m.A.conv}, expected 1`);
    expect(m.B.conv === 0, `B.conv=${m.B.conv}, expected 0`);
  });

  // 5) Validation/failure branch: missing fields → 400
  await test("POST /api/kpi/seen without variant → 400", async () => {
    const r = await req("POST", "/api/kpi/seen", { experiment: exp });
    expect(r.status === 400, `status ${r.status}, expected 400`);
    expect(r.json.ok === false, "ok should be false");
  });

  // 6) Validation/failure branch: invalid variant → 400
  await test("POST /api/kpi/convert invalid variant → 400", async () => {
    const r = await req("POST", "/api/kpi/convert", { experiment: exp, variant: "Z" });
    expect(r.status === 400, `status ${r.status}, expected 400`);
    expect(r.json.ok === false, "ok should be false");
  });

  console.log(`\n=== Summary: ${PASS} passed, ${FAIL} failed ===`);
  if (FAIL) {
    console.log("Failures:");
    for (const f of fails) console.log(" -", f);
    process.exitCode = 1;
  }
})();
