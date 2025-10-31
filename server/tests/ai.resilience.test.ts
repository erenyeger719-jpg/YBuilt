import { expect, test } from "vitest";
import { promises as fs } from "fs";

const BASE = process.env.AI_BASE ?? "http://localhost:5050/api/ai";

// tiny fetch helper
async function j(url: string, body?: any, headers: Record<string,string> = {}) {
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(t); }
}

test("metrics stays up even if url.costs.json is corrupted", async () => {
  // 1) make a ship so caches exist
  const a = await j(`${BASE}/instant`, { prompt: "resilience ship", sessionId: "r1" });
  expect(a.ok).toBe(true);

  // 2) corrupt .cache/url.costs.json (same chaos we do in shell)
  await fs.mkdir(".cache", { recursive: true });
  await fs.writeFile(".cache/url.costs.json", "{ this is : not json ]", "utf8");

  // 3) metrics should still respond ok (fallback logic)
  const m = await j(`${BASE}/metrics`);
  expect(m.ok).toBe(true);
  expect(m).toHaveProperty("url_costs"); // present despite the corrupt file
});
