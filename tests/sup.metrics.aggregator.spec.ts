// tests/sup.metrics.aggregator.spec.ts
import { describe, it, expect } from "vitest";
import {
  aggregateSupEvents,
  type SupEvent,
} from "../server/sup/metrics.aggregator";

describe("sup/metrics.aggregator – aggregateSupEvents", () => {
  it("computes confusion matrix counts + rates", () => {
    const events: SupEvent[] = [
      // correct blocks (TP)
      { decision: "block", label: "bad" },
      { decision: "block", label: "bad" },

      // incorrect blocks (FP)
      { decision: "block", label: "good" },

      // correct allows (TN)
      { decision: "allow", label: "good" },
      { decision: "allow", label: "good" },

      // incorrect allows (FN)
      { decision: "allow", label: "bad" },
    ];

    const summary = aggregateSupEvents(events);

    expect(summary.total).toBe(6);
    expect(summary.truePositives).toBe(2);
    expect(summary.falsePositives).toBe(1);
    expect(summary.trueNegatives).toBe(2);
    expect(summary.falseNegatives).toBe(1);

    // FN rate = FN / (TP + FN) = 1 / (2 + 1) = 1/3
    expect(summary.falseNegativeRate).toBeCloseTo(1 / 3, 5);
    // FP rate = FP / (TN + FP) = 1 / (2 + 1) = 1/3
    expect(summary.falsePositiveRate).toBeCloseTo(1 / 3, 5);
  });

  it("computes p95 latency from finite values and ignores junk", () => {
    const events: SupEvent[] = [
      { decision: "allow", label: "good", latencyMs: 50 },
      { decision: "allow", label: "good", latencyMs: 80 },
      { decision: "block", label: "bad", latencyMs: 100 },
      { decision: "block", label: "bad", latencyMs: 200 },
      // junk latencies that should be ignored
      { decision: "allow", label: "good", latencyMs: -10 },
      { decision: "allow", label: "good", latencyMs: Number.NaN },
      { decision: "allow", label: "good" },
    ];

    const summary = aggregateSupEvents(events);

    // Valid latencies are [50, 80, 100, 200].
    // Sorted: [50, 80, 100, 200]
    // p95 index = 0.95 * (4 - 1) = 2.85 → between idx 2 and 3.
    // Value ≈ 100 + 0.85 * (200 - 100) = 185
    expect(summary.p95LatencyMs).toBeGreaterThanOrEqual(180);
    expect(summary.p95LatencyMs).toBeLessThanOrEqual(190);
  });

  it("returns null p95 latency when there are no valid latencies", () => {
    const events: SupEvent[] = [
      { decision: "allow", label: "good" },
      { decision: "block", label: "bad", latencyMs: Number.NaN },
    ];

    const summary = aggregateSupEvents(events);

    expect(summary.p95LatencyMs).toBeNull();
  });

  it("aggregates cost per URL in cents", () => {
    const events: SupEvent[] = [
      {
        decision: "allow",
        label: "good",
        url: "https://example.com/a",
        costCents: 5,
      },
      {
        decision: "allow",
        label: "good",
        url: "https://example.com/a",
        costCents: 10,
      },
      {
        decision: "block",
        label: "bad",
        url: "https://example.com/b",
        costCents: 7,
      },
      // Ignore missing URL or non-finite cost.
      {
        decision: "allow",
        label: "good",
        url: null,
        costCents: 100,
      },
      {
        decision: "allow",
        label: "good",
        url: "https://example.com/c",
        costCents: Number.NaN,
      },
    ];

    const summary = aggregateSupEvents(events);

    expect(summary.costPerUrlCents["https://example.com/a"]).toBe(15);
    expect(summary.costPerUrlCents["https://example.com/b"]).toBe(7);
    expect(summary.costPerUrlCents["https://example.com/c"]).toBeUndefined();
  });
});
