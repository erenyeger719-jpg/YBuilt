// tests/guardrails.config.spec.ts
import { describe, it, expect, vi } from "vitest";

describe("config/guardrails", () => {
  it("exposes sane default thresholds", async () => {
    // Make sure we test with a clean module graph.
    vi.resetModules();
    delete process.env.NO_JS_DEFAULT;

    const { GUARDRAILS } = await import("../server/config/guardrails.ts");

    expect(GUARDRAILS.perf.clsGoodMax).toBeGreaterThan(0);
    expect(GUARDRAILS.perf.lcpGoodMs).toBeGreaterThan(0);
    expect(GUARDRAILS.readability.minScore).toBeGreaterThanOrEqual(0);
    expect(GUARDRAILS.readability.minScore).toBeLessThanOrEqual(100);

    // With NO_JS_DEFAULT unset, defaultNoJs should be false.
    expect(GUARDRAILS.nojs.defaultNoJs).toBe(false);
  });

  it("respects NO_JS_DEFAULT=1 for no-JS default", async () => {
    vi.resetModules();
    process.env.NO_JS_DEFAULT = "1";

    const { GUARDRAILS } = await import("../server/config/guardrails.ts");

    expect(GUARDRAILS.nojs.defaultNoJs).toBe(true);
  });
});
