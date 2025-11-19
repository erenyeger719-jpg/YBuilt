import { describe, it, expect } from "vitest";
import { agent } from "./testServer";

describe("Perf/load: metrics endpoints stay healthy under repetition", () => {
  it("handles repeated /metrics, /metrics/guardrail and /kpi calls without 500s", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    // Keep it modest but non-trivial
    const N = 30;

    for (let i = 0; i < N; i++) {
      // /metrics
      const rMetrics = await a.get("/api/ai/metrics");
      expect(rMetrics.status).not.toBe(500);
      if (rMetrics.status === 200) {
        expect(rMetrics.body).toBeTruthy();
        expect(rMetrics.body.ok).toBe(true);
      }

      // /metrics/guardrail
      const rGuardrail = await a.get("/api/ai/metrics/guardrail");
      expect(rGuardrail.status).not.toBe(500);
      if (rGuardrail.status === 200) {
        expect(rGuardrail.body).toBeTruthy();
        expect(rGuardrail.body.ok).toBe(true);
      }

      // /kpi
      const rKpi = await a.get("/api/ai/kpi");
      expect(rKpi.status).not.toBe(500);
      if (rKpi.status === 200) {
        expect(rKpi.body).toBeTruthy();
        expect(rKpi.body.ok).toBe(true);
      }
    }
  });
});
