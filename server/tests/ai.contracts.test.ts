import { expect, test } from "vitest";

const BASE = process.env.AI_BASE ?? "http://localhost:5050/api/ai";

async function j(url: string, body?: any, headers: Record<string,string> = {}) {
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(t); }
}

test("instant contract: ok + url|path + spec minimally shaped", async () => {
  const out = await j(`${BASE}/instant`, { prompt: "minimal saas", sessionId: "c1" });
  expect(out.ok).toBe(true);
  expect(typeof (out.url ?? out.result?.path)).toBe("string");
  // spec must exist with minimal keys—this guards planner regressions.
  expect(out).toHaveProperty("spec");
  expect(out.spec).toHaveProperty("brand");
  expect(out.spec).toHaveProperty("layout");
});

test("proof contract: structured fields present", async () => {
  const a = await j(`${BASE}/instant`, { prompt: "portfolio", sessionId: "c2" });
  const pid = a.result?.pageId;
  const pr = await j(`${BASE}/proof/${pid}`);
  expect(pr.ok).toBe(true);
  expect(pr).toHaveProperty("proof");
  expect(typeof pr.proof.proof_ok).toBe("boolean");
  expect(typeof pr.proof.fact_counts).toBe("object");
});

test("metrics contract: url_costs and roll-up numbers exist", async () => {
  const m = await j(`${BASE}/metrics`);
  expect(m.ok).toBe(true);
  expect(m).toHaveProperty("cloud_pct");
  expect(m).toHaveProperty("url_costs");
  expect(typeof m.url_costs.pages).toBe("number");
});

test("kpi convert mutates state (monotonic check)", async () => {
  const a = await j(`${BASE}/instant`, { prompt: "landing page", sessionId: "c3" });
  const pid = a.result?.pageId;
  const before = await j(`${BASE}/kpi`);
  await j(`${BASE}/kpi/convert`, { pageId: String(pid) });
  const after = await j(`${BASE}/kpi`);
  // Only check that something moved; exact schema may vary.
  expect(JSON.stringify(after)).not.toEqual(JSON.stringify(before));
});
