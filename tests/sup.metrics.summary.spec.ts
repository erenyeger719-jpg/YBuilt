import { describe, it, expect } from "vitest";
import {
  summarizeSupAudit,
  type SupAuditRow,
} from "../server/metrics/sup.summary.ts";

describe("sup/metrics – summarizeSupAudit", () => {
  it("returns zeros and nulls for empty input", () => {
    const summary = summarizeSupAudit([]);

    expect(summary.total).toBe(0);
    expect(summary.modes.allow).toBe(0);
    expect(summary.modes.strict).toBe(0);
    expect(summary.modes.block).toBe(0);
    expect(summary.modes.other).toBe(0);
    expect(summary.avg_ms).toBeNull();
    expect(summary.p95_ms).toBeNull();
    expect(summary.pii_present).toBe(0);
    expect(summary.abuse_with_reasons).toBe(0);
  });

  it("aggregates modes, latency, pii and abuse correctly", () => {
    const rows: SupAuditRow[] = [
      {
        mode: "allow",
        ms: 100,
        pii_present: false,
        abuse_reasons: [],
      },
      {
        mode: "strict",
        ms: 200,
        pii_present: true,
        abuse_reasons: ["abuse:velocity"],
      },
      {
        mode: "block",
        ms: 400,
        pii_present: false,
        abuse_reasons: ["abuse:scam_lang"],
      },
    ];

    const summary = summarizeSupAudit(rows);

    expect(summary.total).toBe(3);
    expect(summary.modes.allow).toBe(1);
    expect(summary.modes.strict).toBe(1);
    expect(summary.modes.block).toBe(1);
    expect(summary.modes.other).toBe(0);

    // Latency
    // avg = (100 + 200 + 400) / 3 ≈ 233.3
    expect(summary.avg_ms).not.toBeNull();
    expect(Math.round(summary.avg_ms as number)).toBe(233);

    // p95 should be the largest here (400)
    expect(summary.p95_ms).toBe(400);

    // PII / abuse
    expect(summary.pii_present).toBe(1);
    expect(summary.abuse_with_reasons).toBe(2);
  });
});
