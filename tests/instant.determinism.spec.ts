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

  it("keeps /instant deterministic and healthy under repeated calls in test mode", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    // Reuse the known-safe prompt from the first test
    const prompt = "deterministic prompt for SUP";
    const N = 40;

    const pageIds = new Set<string>();

    for (let i = 0; i < N; i++) {
      const r = await a.post("/api/ai/instant").send({ prompt });

      // Endpoint must not 500, even if quotas/guards kick in.
      expect(r.status).not.toBe(500);
      expect(r.body).toBeTruthy();

      // Only record pageIds for successful responses
      if (r.body.ok && r.body.result?.pageId) {
        pageIds.add(r.body.result.pageId);
      }
    }

    // If we ever get a successful /instant, it should be deterministic.
    if (pageIds.size > 0) {
      expect(pageIds.size).toBe(1);
    }
  });

  it("keeps /one deterministic and healthy under repeated calls in test mode", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    // Reuse the same known-safe prompt
    const prompt = "deterministic prompt for SUP";
    const N = 40;

    const pageIds = new Set<string>();

    for (let i = 0; i < N; i++) {
      const r = await a.post("/api/ai/one").send({ prompt });

      // Endpoint must not 500, even if quotas/guards kick in.
      expect(r.status).not.toBe(500);

      // Only record pageIds when the result is present
      if (r.body?.result?.pageId) {
        pageIds.add(r.body.result.pageId);
      }
    }

    // If we ever get a successful /one, it should be deterministic.
    if (pageIds.size > 0) {
      expect(pageIds.size).toBe(1);
    }
  });
});
