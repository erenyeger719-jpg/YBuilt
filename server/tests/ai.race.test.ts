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

test("10 parallel instant ships: no 5xx, unique pageIds, metrics move up", async () => {
  const before = await j(`${BASE}/metrics`);
  expect(before.ok).toBe(true);

  const N = 10;
  const runs = Array.from({ length: N }, (_, i) =>
    j(`${BASE}/instant`, { prompt: `parallel ${i}`, sessionId: `race${i}` })
  );
  const outs = await Promise.all(runs);

  // All should be ok
  outs.forEach(o => expect(o.ok).toBe(true));

  // Unique pageIds for those that returned one
  const ids = outs.map(o => o.result?.pageId).filter(Boolean) as string[];
  const uniq = new Set(ids);
  expect(uniq.size).toBe(ids.length); // no collisions

  // Metrics should be >= prior (monotonic)
  const after = await j(`${BASE}/metrics`);
  expect(after.ok).toBe(true);
  expect(after.url_costs.pages >= before.url_costs.pages).toBe(true);
});
