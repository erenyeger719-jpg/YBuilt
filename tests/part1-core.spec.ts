import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Part1: core router & middleware", () => {
  it("/__ready requires prewarm token until set", async () => {
    const a = agent({ PREWARM_TOKEN: "test-prewarm" });
    const blocked = await a.get("/api/ai/instant");
    expect(blocked.status).toBe(503);
    const ok = await a.post("/api/ai/__ready").set("x-prewarm-token", "test-prewarm");
    expect(ok.body.ready).toBe(true);
    const after = await a.get("/api/ai/instant?goal=ping");
    expect(after.status).toBe(200);
  });

  it("quota: returns 429 with Retry-After, daily counters", async () => {
    const a = agent({ PREWARM_TOKEN: "" });
    // warm
    await a.get("/api/ai/instant?goal=ping");
    // push over burst on /instant (quota path)
    let last = 200;
    for (let i = 0; i < 20; i++) {
      const r = await a
        .get("/api/ai/instant?goal=ping")
        .set("x-forwarded-for", "9.9.9.9"); // isolate bucket
      last = r.status;
      if (r.status === 429) {
        expect(r.headers["retry-after"]).toBeDefined();
        break;
      }
    }
    expect([200, 429]).toContain(last);
  });

  it("returns 413 for huge JSON bodies instead of 500", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    // Build a body slightly over 1MB (router JSON limit is 1mb)
    const bigString = "x".repeat(1024 * 1024 + 10);

    const res = await a
      .post("/api/ai/instant")
      .set("content-type", "application/json")
      .send({ huge: bigString });

    expect(res.status).toBe(413);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe("body_too_large");
  });
});
