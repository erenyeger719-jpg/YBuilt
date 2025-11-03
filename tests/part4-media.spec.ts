import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Part4: media, vectors, evidence", () => {
  it("/vectors/search returns deterministic items in tests", async () => {
    const a = agent({ NODE_ENV: "test", PREWARM_TOKEN: "" });
    const r = await a.get("/api/ai/vectors/search?q=saas&limit=5");
    expect(r.body.ok).toBe(true);
    expect(Array.isArray(r.body.items)).toBe(true);
    expect(r.body.items.length).toBeGreaterThan(0);
  });

  it("evidence add → reindex → search round trip", async () => {
    const a = agent({ PREWARM_TOKEN: "" });
    const add = await a.post("/api/ai/evidence/add").send({
      id: "ev1",
      url: "https://example.com",
      title: "Sample",
      text: "Ybuilt ships calm pages."
    });
    expect(add.body.ok).toBe(true);
    const re = await a.post("/api/ai/evidence/reindex").send({});
    expect(re.body.ok).toBe(true);
    const sr = await a.get("/api/ai/evidence/search?q=calm");
    expect(sr.body.ok).toBe(true);
    expect(sr.body.hits[0]?.id).toBe("ev1");
  });
});
