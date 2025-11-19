import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Perf/load: mixed hot endpoints survive repeated calls", () => {
  it("handles repeated mixed calls without 500s", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    const prompt = "mixed perf/load test prompt";
    const N = 20; // small but non-trivial soak

    for (let i = 0; i < N; i++) {
      // /instant
      const rInstant = await a.post("/api/ai/instant").send({ prompt });
      expect(rInstant.status).not.toBe(500);

      // /one
      const rOne = await a.post("/api/ai/one").send({ prompt });
      expect(rOne.status).not.toBe(500);

      // /metrics
      const rMetrics = await a.get("/api/ai/metrics");
      expect(rMetrics.status).not.toBe(500);

      // /metrics/guardrail
      const rGuardrail = await a.get("/api/ai/metrics/guardrail");
      expect(rGuardrail.status).not.toBe(500);

      // /kpi
      const rKpi = await a.get("/api/ai/kpi");
      expect(rKpi.status).not.toBe(500);

      // /risk
      const rRisk = await a.get(
        `/api/ai/risk?prompt=${encodeURIComponent(prompt)}`,
      );
      expect(rRisk.status).not.toBe(500);
    }
  });
});
