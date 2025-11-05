import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Perf/load: SUP core routes survive a small burst", () => {
  it("handles a burst on /instant and /one without 500s", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const tasks: Promise<unknown>[] = [];

    // Tune N if needed, but 20x2 is a nice little poke
    const N = 20;

    for (let i = 0; i < N; i++) {
      // /instant burst
      tasks.push(
        a
          .post("/api/ai/instant")
          .send({
            prompt: `load test instant ${i}`,
            sessionId: `lt-inst-${i}`,
          })
          .then((res) => {
            // Key guarantee: no 500s
            expect(res.status).not.toBe(500);

            // When we do get a 200, body.ok should be true
            if (res.status === 200) {
              expect(res.body).toBeTruthy();
              expect(res.body.ok).toBe(true);
            }
          }),
      );

      // /one burst
      tasks.push(
        a
          .post("/api/ai/one")
          .send({
            prompt: `load test one ${i}`,
            sessionId: `lt-one-${i}`,
          })
          .then((res) => {
            expect(res.status).not.toBe(500);

            if (res.status === 200) {
              expect(res.body).toBeTruthy();
              expect(res.body.ok).toBe(true);
            }
          }),
      );
    }

    await Promise.all(tasks);
  });
});
