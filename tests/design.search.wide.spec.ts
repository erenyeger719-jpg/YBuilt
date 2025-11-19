// tests/design.search.wide.spec.ts
import { describe, it, expect } from "vitest";
import { wideTokenSearch } from "../server/design/search.wide.ts";
import { searchBestTokensCached } from "../server/design/search.memo.ts";

describe("design/search.wide – wideTokenSearch", () => {
  it("returns a structured result and never throws", () => {
    const res = wideTokenSearch({
      primary: "#6d28d9",
      tone: "serious",
      dark: false,
    });

    expect(res).toBeDefined();
    expect(res.tokens).toBeTruthy();

    // picked shape
    expect(typeof res.picked.primary).toBe("string");
    expect(typeof res.picked.tone).toBe("string");
    expect(typeof res.picked.dark).toBe("boolean");
    expect(typeof res.picked.score).toBe("number");
    expect(typeof res.picked.a11y).toBe("boolean");

    // basic counters
    expect(res.tried).toBeGreaterThan(0);
    expect(res.candidates).toBeGreaterThan(0);

    // top5 sanity
    expect(Array.isArray(res.top5)).toBe(true);
    if (res.top5) {
      expect(res.top5.length).toBeLessThanOrEqual(5);
      for (const t of res.top5) {
        expect(typeof t.primary).toBe("string");
        expect(typeof t.tone).toBe("string");
        expect(typeof t.dark).toBe("boolean");
        expect(typeof t.score).toBe("number");
        expect(typeof t.a11y).toBe("boolean");
      }
    }
  });

  it("is deterministic for the same inputs", () => {
    const opts = { primary: "#6d28d9", tone: "minimal", dark: true };

    const a = wideTokenSearch(opts);
    const b = wideTokenSearch(opts);

    // picked should be exactly the same for the same opts
    expect(a.picked).toEqual(b.picked);
  });

  it("normalizes tone strings consistently", () => {
    const lower = wideTokenSearch({
      primary: "#6d28d9",
      tone: "minimal",
      dark: false,
    });

    const mixedCase = wideTokenSearch({
      primary: "#6d28d9",
      tone: "Minimal",
      dark: false,
    });

    // normalizeTone should make these equivalent
    expect(lower.picked.tone).toBe(mixedCase.picked.tone);
  });

  it("searchBestTokensCached is stable for the same (goal, industry, dna)", async () => {
    const args = {
      goal: "waitlist",
      industry: "saas",
      dna: { brand: { tone: "minimal" } },
    };

    const first = await searchBestTokensCached(args);
    const second = await searchBestTokensCached(args);

    expect(first).toBeTruthy();
    expect(second).toEqual(first);
  });
});
