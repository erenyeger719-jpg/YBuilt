import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Determinism: /instant and /one", () => {
  it("returns the same pageId for the same prompt in test mode", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const prompt = "deterministic prompt for SUP";

    // /instant should be stable
    const r1 = await a.post("/api/ai/instant").send({ prompt });
    const r2 = await a.post("/api/ai/instant").send({ prompt });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body?.result?.pageId).toBeDefined();
    expect(r1.body.result.pageId).toBe(r2.body.result.pageId);

    // /one should also be stable
    const o1 = await a.post("/api/ai/one").send({ prompt });
    const o2 = await a.post("/api/ai/one").send({ prompt });

    expect(o1.status).toBe(200);
    expect(o2.status).toBe(200);
    expect(o1.body?.result?.pageId).toBeDefined();
    expect(o1.body.result.pageId).toBe(o2.body.result.pageId);
  });
});
