// tests/metrics.outcome.spec.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordUrlCost,
  recordUrlConversion,
  snapshotUrlCosts,
  resetOutcomeMetrics,
} from "../server/metrics/outcome";

describe("metrics/outcome – outcome brain", () => {
  beforeEach(() => {
    resetOutcomeMetrics();
  });

  it("tracks basic ship events by pageId", () => {
    recordUrlCost(null, "pg_abc123", 100, 5);
    recordUrlCost(null, "pg_abc123", 50, 2);

    const snap = snapshotUrlCosts();
    const key = "page:pg_abc123";

    expect(snap[key]).toBeDefined();
    expect(snap[key].hits).toBe(2);
    expect(snap[key].tokens).toBe(150);
    expect(snap[key].cents).toBe(7);
    expect(snap[key].conversions).toBe(0);
  });

  it("increments conversions and supports URL-based keys", () => {
    const url = "https://example.com/foo";

    recordUrlCost(url, null, 10, 1);
    recordUrlConversion(url);

    const snap = snapshotUrlCosts();
    const key = `url:${url}`;

    expect(snap[key]).toBeDefined();
    expect(snap[key].hits).toBe(1);
    expect(snap[key].tokens).toBe(10);
    expect(snap[key].cents).toBe(1);
    expect(snap[key].conversions).toBe(1);
  });

  it("tracks per-workspace url costs", () => {
    resetOutcomeMetrics();

    recordUrlCost("https://example.com", "pg_test", 100, 5, "ws_alpha");
    recordUrlCost("https://example.com", "pg_test", 50, 2, "ws_beta");

    // also simulate a conversion in one workspace
    recordUrlConversion("pg_test", "ws_alpha");

    const snap = snapshotUrlCosts();
    const key = "page:pg_test";
    const entry: any = snap[key];

    expect(entry).toBeDefined();
    expect(entry.hits).toBe(2);
    expect(entry.tokens).toBe(150);
    expect(entry.cents).toBe(7);

    expect(entry.byWorkspace).toBeDefined();
    expect(entry.byWorkspace.ws_alpha.hits).toBe(1);
    expect(entry.byWorkspace.ws_alpha.conversions).toBe(1);

    expect(entry.byWorkspace.ws_beta.hits).toBe(1);
    expect(entry.byWorkspace.ws_beta.conversions).toBe(0);
  });
});
