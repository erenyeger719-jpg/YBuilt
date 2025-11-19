// tests/sup.metrics.northstar.spec.ts
import { describe, it, expect } from "vitest";
import {
  summarizeNorthstarMetrics,
  type SupAuditEvent,
} from "../server/sup/metrics.northstar";

describe("sup/metrics – northstar aggregator", () => {
  it("returns sane defaults for empty input", () => {
    const summary = summarizeNorthstarMetrics([]);

    expect(summary.total).toBe(0);
    expect(summary.tp).toBe(0);
    expect(summary.tn).toBe(0);
    expect(summary.fp).toBe(0);
    expect(summary.fn).toBe(0);

    expect(summary.fnRate).toBeNull();
    expect(summary.fpRate).toBeNull();
    expect(summary.p95LatencyMs).toBeNull();
    expect(summary.avgCostCents).toBeNull();

    expect(summary.labeledCount).toBe(0);
    expect(summary.labelCoverage).toBe(0);
  });

  it("computes fn/fp rates, p95 latency and avg cost from labeled events", () => {
    const events: SupAuditEvent[] = [
      {
        ts: 1,
        route: "/act",
        latencyMs: 100,
        costCents: 0.1,
        label: "tp",
      },
      {
        ts: 2,
        route: "/act",
        latencyMs: 200,
        costCents: 0.2,
        label: "fp",
      },
      {
        ts: 3,
        route: "/act",
        latencyMs: 300,
        costCents: 0.3,
        label: "fn",
      },
      {
        ts: 4,
        route: "/one",
        latencyMs: 400,
        costCents: 0.4,
        label: "tn",
      },
      {
        ts: 5,
        route: "/one",
        latencyMs: 500,
        // unlabeled, but still counts for latency/cost stats if cost present
      },
    ];

    const summary = summarizeNorthstarMetrics(events);

    // Totals
    expect(summary.total).toBe(5);
    expect(summary.labeledCount).toBe(4);
    expect(summary.labelCoverage).toBeCloseTo(4 / 5);

    // Confusion matrix
    expect(summary.tp).toBe(1);
    expect(summary.tn).toBe(1);
    expect(summary.fp).toBe(1);
    expect(summary.fn).toBe(1);

    // Positives: tp + fn = 2 -> fnRate = 1/2
    expect(summary.fnRate).toBeCloseTo(0.5);

    // Negatives: tn + fp = 2 -> fpRate = 1/2
    expect(summary.fpRate).toBeCloseTo(0.5);

    // Latencies: [100, 200, 300, 400, 500]
    // p95 index = floor(0.95 * (5 - 1)) = floor(3.8) = 3 -> 400
    expect(summary.p95LatencyMs).toBe(400);

    // Costs: 0.1 + 0.2 + 0.3 + 0.4 = 1.0 over 4 events = 0.25 average
    expect(summary.avgCostCents).toBeCloseTo(0.25);
  });

  it("ignores non-finite latency and cost values", () => {
    const events: SupAuditEvent[] = [
      {
        ts: 1,
        route: "/act",
        latencyMs: 100,
        costCents: 1,
        label: "tp",
      },
      {
        ts: 2,
        route: "/act",
        latencyMs: NaN,
        costCents: 2,
        label: "tn",
      },
      {
        ts: 3,
        route: "/act",
        latencyMs: 300,
        costCents: Infinity,
        label: "fp",
      },
    ];

    const summary = summarizeNorthstarMetrics(events);

    // Latencies considered: 100, 300
    // p95 index = floor(0.95 * (2 - 1)) = 0 -> 100
    expect(summary.p95LatencyMs).toBe(100);

    // Costs considered: 1, 2 -> avg = 1.5
    expect(summary.avgCostCents).toBeCloseTo(1.5);
  });
});
