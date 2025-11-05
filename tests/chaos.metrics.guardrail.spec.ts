import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import { agent } from "./testServer";

describe("Chaos: metrics/guardrail survives SUP audit fs read failures", () => {
  it("/metrics/guardrail tolerates fs.readFileSync throwing on audit log", async () => {
    const a = agent({ PREWARM_TOKEN: "" });

    // Capture the real implementation so we can delegate for non-audit reads
    const realReadFileSync = fs.readFileSync;

    const spy = vi
      .spyOn(fs, "readFileSync")
      .mockImplementation((...args: any[]) => {
        const filePath = String(args[0]);

        // Only break SUP audit log reads, let everything else work
        if (filePath.includes("audit.jsonl")) {
          throw new Error("simulated SUP audit read failure");
        }

        return realReadFileSync.apply(fs, args as any);
      });

    let r;
    try {
      r = await a.get("/api/ai/metrics/guardrail");
    } finally {
      // Always restore, even if the request fails
      spy.mockRestore();
    }

    // Endpoint must not 500 even if the SUP audit log is unreadable.
    expect(r.status).toBe(200);
    expect(r.body).toBeTruthy();
    expect(r.body.ok).toBe(true);

    // Shape-only checks: we should still expose SUP guardrail summary fields,
    // even if they represent "no data / default snapshot".
    expect(r.body).toHaveProperty("sup");
    expect(r.body).toHaveProperty("sup_rates");
    expect(r.body).toHaveProperty("conversions_total");
    expect(r.body).toHaveProperty("last_convert_ts");
  });
});
