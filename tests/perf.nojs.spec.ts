// tests/perf.nojs.spec.ts
import { describe, it, expect, beforeEach } from "vitest";
import { shouldStripJS } from "../server/perf/budgets";

describe("perf/budgets – shouldStripJS", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    // reset env between tests
    process.env = { ...OLD_ENV };
    delete process.env.NO_JS_DEFAULT;
  });

  it("returns false when env is off and perf is good", () => {
    const res = shouldStripJS({
      jsBytes: 100 * 1024,  // 100KB
      lcpMs: 2000,          // 2s
      cls: 0.05,
    } as any);

    expect(res).toBe(false);
  });

  it("returns true when env forces no-js, even if perf is good", () => {
    process.env.NO_JS_DEFAULT = "1";

    const res = shouldStripJS({
      jsBytes: 100 * 1024,
      lcpMs: 2000,
      cls: 0.05,
    } as any);

    expect(res).toBe(true);
  });

  it("returns true when perf is clearly bad, even if env is off", () => {
    const res = shouldStripJS({
      jsBytes: 800 * 1024,  // 800KB JS
      lcpMs: 5000,          // 5s LCP
      cls: 0.4,             // very janky
    } as any);

    expect(res).toBe(true);
  });
});
