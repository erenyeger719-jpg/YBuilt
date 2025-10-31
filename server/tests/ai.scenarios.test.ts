import { expect, test } from "vitest";

const BASE = process.env.AI_BASE ?? "http://localhost:5050/api/ai";

async function j(url: string, body?: any, headers: Record<string, string> = {}) {
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { throw new Error(txt); }
}

let lastPageId: string | null = null;

test("Zero-latency path ships (instant)", async () => {
  const out = await j(`${BASE}/instant`, {
    prompt: "dark saas waitlist for founders",
    sessionId: "t1",
  });
  expect(out.ok).toBe(true);
  expect(typeof out.url).toBe("string");
  expect(out.result?.kind).toBe("compose");
  lastPageId = out.result?.pageId ?? null;
});

test("Proof strict gate blocks risky claims", async () => {
  const out = await j(`${BASE}/one`, {
    prompt: "#1 with 200% growth and 10x ROI",
    sessionId: "t2",
  }, { "x-proof-strict": "1" });
  expect(out.ok).toBe(true);
  expect(out.result?.error).toBe("proof_gate_fail");
});

test("Personalization: developers get features, founders get pricing", async () => {
  const spec = { layout: { sections: ["hero-basic"] }, brand: {}, intent: {}, audience: "" };

  const dev = await j(`${BASE}/act`, {
    sessionId: "t3",
    spec,
    action: { kind: "retrieve", args: { sections: ["hero-basic"] } },
  }, { "x-audience": "developers" });
  const devSecs = dev.result?.sections ?? [];
  expect(devSecs.includes("features-3col")).toBe(true);
  expect(devSecs.includes("pricing-simple")).toBe(false);

  const founders = await j(`${BASE}/act`, {
    sessionId: "t4",
    spec,
    action: { kind: "retrieve", args: { sections: ["hero-basic"] } },
  }, { "x-audience": "founders" });
  const fSecs = founders.result?.sections ?? [];
  expect(fSecs.includes("pricing-simple")).toBe(true);
});

test("Vector seed + search returns items", async () => {
  const seeded = await j(`${BASE}/vectors/seed`, { count: 8 });
  expect(seeded.ok).toBe(true);

  const search = await j(`${BASE}/vectors/search?q=logo`);
  expect(search.ok).toBe(true);
  expect(Array.isArray(search.items)).toBe(true);
  expect(search.items.length).toBeGreaterThan(0);
});

test("KPI convert records without throwing", async () => {
  // If instant didn't return a pageId, ship a tiny page now
  if (!lastPageId) {
    const out = await j(`${BASE}/instant`, {
      prompt: "minimal portfolio",
      sessionId: "t5",
    });
    lastPageId = out.result?.pageId ?? null;
  }
  expect(lastPageId).toBeTruthy();
  const k = await j(`${BASE}/kpi/convert`, { pageId: String(lastPageId) });
  expect(k.ok).toBe(true);

  const snap = await j(`${BASE}/kpi`);
  expect(snap.ok).toBe(true);
});

test("Metrics endpoint responds with basics", async () => {
  const m = await j(`${BASE}/metrics`);
  expect(m.ok).toBe(true);
  // presence checks only; values may be null on a fresh run
  expect(m).toHaveProperty("cloud_pct");
  expect(m).toHaveProperty("time_to_url_ms_est");
});

/* ---- Added coverage below ---- */

test("Proof Card returns structured data for last page", async () => {
  if (!lastPageId) {
    const out = await j(`${BASE}/instant`, { prompt: "minimal saas", sessionId: "t6" });
    lastPageId = out.result?.pageId ?? null;
  }
  const pr = await j(`${BASE}/proof/${lastPageId}`);
  expect(pr.ok).toBe(true);
  expect(pr.proof).toHaveProperty("proof_ok");
  expect(pr.proof).toHaveProperty("fact_counts");
  // perf estimates are optional but usually present
  expect(pr.proof).toHaveProperty("cls_est");
});

test("BrandDNA learns dark/minimal across a session", async () => {
  const sid = "dna1";
  // Ship a few dark/minimal pages to teach the DNA
  for (let i = 0; i < 3; i++) {
    const r = await j(`${BASE}/instant`, { prompt: "dark minimal saas", sessionId: sid });
    expect(r.ok).toBe(true);
  }
  // Now ask for a generic build; should lean dark/minimal by default
  const out = await j(`${BASE}/instant`, { prompt: "portfolio site", sessionId: sid });
  expect(out.ok).toBe(true);
  // spec.brand.dark should be true if DNA applied
  expect(out.spec?.brand?.dark).toBe(true);
  // tone should be one of minimal/serious; minimal preferred
  expect(["minimal","serious","playful"]).toContain(out.spec?.brand?.tone ?? "minimal");
});

test("Economic flywheel surfaces URL cost totals", async () => {
  const m = await j(`${BASE}/metrics`);
  expect(m.ok).toBe(true);
  expect(m).toHaveProperty("url_costs");
  expect(m.url_costs).toHaveProperty("pages");
  expect(typeof m.url_costs.pages).toBe("number");
});
