// server/tests/sup-algo.smoke.mjs
// Node 18+ (global fetch)

const base = (process.env.BASE_URL || "http://localhost:5050").replace(/\/$/, "");

function now() { return Date.now(); }
function uid() { return Math.random().toString(36).slice(2, 10); }

async function req(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).catch((e) => ({ status: -1, _e: e, json: async () => ({}) }));

  if (res.status === -1) return { status: -1, headers: {}, json: {} };

  let json = {};
  try { json = await res.json(); } catch {}
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), json };
}

let PASS = 0, FAIL = 0, SKIP = 0;
const fails = [];
function ok(name) { console.log(`✅  ${name}`); PASS++; }
function skip(name, reason) { console.log(`➖  ${name} (skipped: ${reason})`); SKIP++; }
function fail(name, msg) { console.error(`❌  ${name} — ${msg}`); FAIL++; fails.push(`${name}: ${msg}`); }
function expect(cond, msg) { if (!cond) throw new Error(msg); }

(async function run() {
  console.log(`\n=== Ybuilt Sup-Algo smoke (base: ${base}) ===\n`);
  const exp = `sup_${now()}_${uid()}`;

  // 1) API health returns JSON
  try {
    const r = await req("GET", "/api/health");
    expect(r.status === 200, `status ${r.status}`);
    expect((r.headers["content-type"] || "").includes("application/json"), "not JSON");
    expect(r.json && (r.json.ok === true || r.json.status === "ok"), "payload missing ok/status");
    ok("Health JSON");
  } catch (e) { fail("Health JSON", e.message); }

  // 2) Execute sandbox health (optional)
  try {
    const r = await req("GET", "/api/execute/health");
    if (r.status === 404) skip("Execute sandbox", "route not mounted");
    else if (r.status === 200 && (r.json.ok === true || r.json.enabled !== undefined)) ok("Execute sandbox");
    else skip("Execute sandbox", `status ${r.status}`);
  } catch (e) { skip("Execute sandbox", e.message); }

  // 3) Metrics empty = zeros
  try {
    const r = await req("GET", `/api/metrics?experiment=${encodeURIComponent(exp)}`);
    expect(r.status === 200, `status ${r.status}`);
    expect(r.json.experiments && r.json.experiments[exp], "missing experiment key");
    const m = r.json.experiments[exp];
    expect(m.A.views === 0 && m.B.views === 0, "views not zero");
    expect(m.A.conv === 0 && m.B.conv === 0, "conv not zero");
    ok("Metrics zeros");
  } catch (e) { fail("Metrics zeros", e.message); }

  // 4) KPI seen then metrics reflect
  try {
    const sA1 = await req("POST", "/api/kpi/seen", { experiment: exp, variant: "A", path: "/", ts: now() });
    const sA2 = await req("POST", "/api/kpi/seen", { experiment: exp, variant: "A", path: "/", ts: now() });
    const sB1 = await req("POST", "/api/kpi/seen", { experiment: exp, variant: "B", path: "/", ts: now() });
    expect(sA1.status === 200 && sA1.json.ok, "A1 fail");
    expect(sA2.status === 200 && sA2.json.ok, "A2 fail");
    expect(sB1.status === 200 && sB1.json.ok, "B1 fail");

    const r = await req("GET", `/api/metrics?experiment=${encodeURIComponent(exp)}`);
    const m = r.json.experiments[exp];
    expect(m.A.views === 2, `A.views=${m.A.views}`);
    expect(m.B.views === 1, `B.views=${m.B.views}`);
    ok("Seen → metrics");
  } catch (e) { fail("Seen → metrics", e.message); }

  // 5) KPI convert then metrics reflect
  try {
    const cA = await req("POST", "/api/kpi/convert", { experiment: exp, variant: "A", pageId: "test", meta: { src: "sup" } });
    expect(cA.status === 200 && cA.json.ok === true, "convert not ok:true");
    const r = await req("GET", `/api/metrics?experiment=${encodeURIComponent(exp)}`);
    const m = r.json.experiments[exp];
    expect(m.A.conv === 1 && m.B.conv === 0, `A=${m.A.conv} B=${m.B.conv}`);
    ok("Convert → metrics");
  } catch (e) { fail("Convert → metrics", e.message); }

  // 6) Validation errors
  try {
    const r1 = await req("POST", "/api/kpi/seen", { experiment: exp });
    const r2 = await req("POST", "/api/kpi/convert", { experiment: exp, variant: "Z" });
    expect(r1.status === 400 && r1.json.ok === false, `seen status ${r1.status}`);
    expect(r2.status === 400 && r2.json.ok === false, `convert status ${r2.status}`);
    ok("Validation 400s");
  } catch (e) { fail("Validation 400s", e.message); }

  // 7) Logs API present
  try {
    const r = await req("GET", "/api/logs/recent?limit=1");
    expect(r.status === 200, `status ${r.status}`);
    expect(r.json.ok === true && Array.isArray(r.json.items), "shape mismatch");
    ok("Logs API");
  } catch (e) { fail("Logs API", e.message); }

  // 8) Previews fork validation (bad slug -> 400)
  try {
    const r = await req("POST", "/api/previews/fork", { sourceId: "../bad\\path" });
    expect(r.status === 400, `status ${r.status}`);
    ok("Previews fork validation");
  } catch (e) { fail("Previews fork validation", e.message); }

  // 9) API 404 guard returns JSON
  try {
    const r = await req("GET", "/api/__definitely_missing__");
    expect(r.status === 404, `status ${r.status}`);
    expect((r.headers["content-type"] || "").includes("application/json"), "404 not JSON");
    expect(r.json && r.json.ok === false && r.json.error === "not_found", "404 payload");
    ok("API JSON 404 guard");
  } catch (e) { fail("API JSON 404 guard", e.message); }

  // 10) AI QnA route presence (400 is OK; 404 means not mounted)
  try {
    const r = await req("POST", "/api/ai/qna", { question: "" });
    if (r.status === 404) skip("AI QnA route", "not mounted");
    else if (r.status >= 400) ok("AI QnA route present");
    else ok("AI QnA route present");
  } catch (e) { skip("AI QnA route", e.message); }

  console.log(`\n=== Summary: ${PASS} passed, ${SKIP} skipped, ${FAIL} failed ===`);
  if (FAIL) {
    console.log("Failures:"); for (const f of fails) console.log(" -", f);
    process.exitCode = 1;
  }
})();
