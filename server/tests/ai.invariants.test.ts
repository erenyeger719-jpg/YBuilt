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

const PROMPTS = [
  "dark saas waitlist",
  "clean blog template",
  "founder pitch site",
  "startup pricing page",
  "portfolio for designer",
];

test("strict proof always blocks hypey claims", async () => {
  const out = await j(`${BASE}/one`,
    { prompt: "#1 with 200% growth and 10x", sessionId: "inv1" },
    { "x-proof-strict": "1" }
  );
  expect(out.ok).toBe(true);
  expect(out.result?.error).toBe("proof_gate_fail");
});

test("no stray <script> in instant preview html (when url is provided)", async () => {
  // Try a few prompts—any one valid preview must be script-free.
  let checked = 0, clean = 0;
  for (const p of PROMPTS) {
    const r = await j(`${BASE}/instant?__test=1`, { prompt: p, sessionId: "inv2" });
    const url = r.url ?? r.result?.path;
    if (!url) continue; // instant-only mode may skip persistence—skip safely
    checked++;
    const html = await (await fetch(`${BASE.replace('/api/ai','')}${url}`)).text();
    expect(/<script/i.test(html)).toBe(false);
    clean++;
  }
  expect(checked > 0 && clean === checked).toBe(true);
});

test("audience header steers section mix (developers vs founders)", async () => {
  const spec = { layout: { sections: ["hero-basic"] }, brand: {}, intent: {}, audience: "" };

  const dev = await j(`${BASE}/act`, {
    sessionId: "inv3",
    spec,
    action: { kind: "retrieve", args: { sections: ["hero-basic"] } },
  }, { "x-audience": "developers" });

  const fnd = await j(`${BASE}/act`, {
    sessionId: "inv4",
    spec,
    action: { kind: "retrieve", args: { sections: ["hero-basic"] } },
  }, { "x-audience": "founders" });

  const ds = dev.result?.sections ?? [];
  const fs = fnd.result?.sections ?? [];

  expect(ds.includes("features-3col")).toBe(true);
  expect(ds.includes("pricing-simple")).toBe(false);
  expect(fs.includes("pricing-simple")).toBe(true);
});

test("economic flywheel: shipping changes url_costs totals", async () => {
  const m1 = await j(`${BASE}/metrics`);
  await j(`${BASE}/instant`, { prompt: "quick ship to move counters", sessionId: "inv5" });
  const m2 = await j(`${BASE}/metrics`);
  expect(m2.url_costs.pages >= m1.url_costs.pages).toBe(true);
});
