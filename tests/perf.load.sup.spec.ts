import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Perf/load: SUP core routes survive repeated calls", () => {
  it("handles repeated /instant and /one calls without 500s", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    // Keep it reasonably high so it's still a "load-ish" check
    const N = 20;

    for (let i = 0; i < N; i++) {
      // /instant
      const rInstant = await a
        .post("/api/ai/instant")
        .send({
          prompt: `load test instant ${i}`,
          sessionId: `lt-inst-${i}`,
        });

      expect(rInstant.status).not.toBe(500);
      if (rInstant.status === 200) {
        expect(rInstant.body).toBeTruthy();
        expect(rInstant.body.ok).toBe(true);
      }

      // /one
      const rOne = await a
        .post("/api/ai/one")
        .send({
          prompt: `load test one ${i}`,
          sessionId: `lt-one-${i}`,
        });

      expect(rOne.status).not.toBe(500);
      if (rOne.status === 200) {
        expect(rOne.body).toBeTruthy();
        expect(rOne.body.ok).toBe(true);
      }
    }
  });
});
