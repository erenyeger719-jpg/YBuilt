// Run: npm run ai:e2e
const BASE = process.env.AI_BASE ?? "http://localhost:5050/api/ai";
const H = (extra: Record<string,string> = {}) => ({ "content-type":"application/json", ...extra });

async function j(method: "GET"|"POST", url: string, body?: any, headers?: any) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text();
  try { return { status: res.status, json: JSON.parse(txt) }; } catch { return { status: res.status, json: null, txt }; }
}
function assert(cond: any, msg: string) { if (!cond) throw new Error(msg); }

(async () => {
  // Determinism
  const ids: (string|null)[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await j("POST", `${BASE}/one`, { prompt:"dark saas waitlist for founders", sessionId:"det" }, H({ "x-test":"1" }));
    ids.push(r.json?.result?.pageId ?? null);
  }
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  assert(uniq.length === 1, `Determinism drift: ${JSON.stringify(ids)}`);
  assert(!ids.includes(null), `Determinism returned null pageId: ${JSON.stringify(ids)}`);

  // Persona routing
  const rDev = await j("POST", `${BASE}/act`, {
    sessionId:"p1", spec:{ layout:{ sections:["hero-basic"] } },
    action:{ kind:"retrieve", args:{ sections:["hero-basic"] } }
  }, H({ "x-audience":"developers" }));
  const rFnd = await j("POST", `${BASE}/act`, {
    sessionId:"p2", spec:{ layout:{ sections:["hero-basic"] } },
    action:{ kind:"retrieve", args:{ sections:["hero-basic"] } }
  }, H({ "x-audience":"founders" }));
  assert(rDev.json?.result?.sections.includes("features-3col"), "Dev persona missing features-3col");
  assert(rFnd.json?.result?.sections.includes("pricing-simple"), "Founder persona missing pricing-simple");

  // Proof strict
  const rProof = await j("POST", `${BASE}/one`, { prompt:"We are #1 and 200% better than competitors", sessionId:"proof" }, H({ "x-proof-strict":"1" }));
  assert(rProof.json?.result?.error === "proof_gate_fail", "Proof strict did not block");

  // Device gate strict
  const rGate = await j("POST", `${BASE}/one`, { prompt:"max breadth dark playful ecomm", sessionId:"gate", breadth:"max" }, H({ "x-device-gate":"strict" }));
  assert(rGate.json?.result?.error === "device_gate_fail", "Device gate strict did not block");

  // No-JS default
  const rNoj = await j("POST", `${BASE}/one`, { prompt:"minimal light saas waitlist", sessionId:"noj" }, H());
  const pid = rNoj.json?.result?.pageId;
  assert(pid, "No pageId from no-JS test");
  const htmlRes = await fetch(`${BASE}/previews/${pid}`);
  const html = await htmlRes.text();
  assert(!/<script/i.test(html), "Found <script> in no-JS preview");

  // Metrics sanity
  const m = await j("GET", `${BASE}/metrics`, undefined, H());
  const cloudPct = m.json?.cloud_pct ?? 100;
  const ttu = m.json?.time_to_url_ms_est ?? 99999;
  const hit = m.json?.retrieval_hit_rate_pct ?? 0;
  assert(cloudPct <= 20, `Cloud% too high: ${cloudPct}`);
  assert(ttu <= 2000, `TTU too slow: ${ttu}`);
  assert(hit >= 50, `Retrieval hit rate too low: ${hit}`);

  console.log("✅ AI E2E passed");
  process.exit(0);
})().catch(e => { console.error("❌ AI E2E failed:", e.message || e); process.exit(1); });
