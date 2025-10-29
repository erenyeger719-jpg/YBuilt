// server/tests/smoke.mjs
// Node 18+ (global fetch)

const base = (process.env.BASE_URL || "http://localhost:5050").replace(/\/$/, "");

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

let PASS = 0, FAIL = 0, SKIP = 0;
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
async function skip(name, reason) {
  console.log(`➖  ${name} (skipped: ${reason})`);
  SKIP++;
}

function expect(cond, msg) { if (!cond) throw new Error(msg); }

(async function run() {
  console.log(`\n=== Ybuilt backend smoke (base: ${base}) ===\n`);
  const exp = `smoke_${now()}_${uid()}`;

  // 1) Health (optional)
  const h = await req("GET", "/api/execute/health");
  if (h.status === 200 && h.json && h.json.ok === true) {
    console.log(`✅  GET /api/execute/health ok:true`);
    PASS++;
  } else if (h.status === 404) {
    await skip("GET /api/execute/health", "route not mounted");
  } else if (h.status === 200) {
    await skip("GET /api/execute/health", "non-standard payload");
  } else {
    await skip("GET /api/execute/health", `status ${h.status}`);
  }

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
    const seen = (variant) =>
      req("POST", "/api/kpi/seen", { experiment: exp, variant, path: "/", ts: now() });
    const r1 = await seen("A"); const r2 = await seen("A"); const r3 = await seen("B");
    expect(r1.status === 200 && r1.json.ok, "first seen failed");
    expect(r2.status === 200 && r2.json.ok, "second seen failed");
    expect(r3.status === 200 && r3.json.ok, "third seen failed");

    const r = await req("GET", `/api/metrics?experiment=${encodeURIComponent(exp)}`);
    const m = r.json.experiments[exp];
    expect(m.A.views === 2, `A.views=${m.A.views}, expected 2`);
    expect(m.B.views === 1, `B.views=${m.B.views}, expected 1`);
    expect(m.A.conv === 0 && m.B.conv === 0, "conv should still be 0");
  });

  // 4) KPI/convert — happy path
  await test("POST /api/kpi/convert (A x1) then metrics reflect conv", async () => {
    const r1 = await req("POST", "/api/kpi/convert", {
      experiment: exp, variant: "A", pageId: "test-page", meta: { src: "smoke" },
    });
    expect(r1.status === 200 && r1.json.ok === true, "convert ok !== true");

    const r = await req("GET", `/api/metrics?experiment=${encodeURIComponent(exp)}`);
    const m = r.json.experiments[exp];
    expect(m.A.conv === 1, `A.conv=${m.A.conv}, expected 1`);
    expect(m.B.conv === 0, `B.conv=${m.B.conv}, expected 0`);
  });

  // 5) Validation/failure: missing fields → 400
  await test("POST /api/kpi/seen without variant → 400", async () => {
    const r = await req("POST", "/api/kpi/seen", { experiment: exp });
    expect(r.status === 400, `status ${r.status}, expected 400`);
    expect(r.json.ok === false, "ok should be false");
  });

  // 6) Validation/failure: invalid variant → 400
  await test("POST /api/kpi/convert invalid variant → 400", async () => {
    const r = await req("POST", "/api/kpi/convert", { experiment: exp, variant: "Z" });
    expect(r.status === 400, `status ${r.status}, expected 400`);
    expect(r.json.ok === false, "ok should be false");
  });

  console.log(`\n=== Summary: ${PASS} passed, ${SKIP} skipped, ${FAIL} failed ===`);
  if (FAIL) {
    console.log("Failures:");
    for (const f of fails) console.log(" -", f);
    process.exitCode = 1;
  }
})();
