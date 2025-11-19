// tests/vector.motifs.spec.ts
import { describe, it, expect } from "vitest";
import {
  summarizeMotifs,
  rankMotifsForBrand,
  type MotifEvent,
} from "../server/media/vector.motifs";

describe("media/vector.motifs – network effect brain", () => {
  it("aggregates impressions and conversions per (brand, motif)", () => {
    const events: MotifEvent[] = [
      // Brand "acme", motif hero: 3 impressions, 2 conversions
      { motifId: "hero", brandKey: "acme", seen: true, converted: true },
      { motifId: "hero", brandKey: "acme", seen: true, converted: false },
      { motifId: "hero", brandKey: "acme", seen: true, converted: true },

      // Brand "acme", motif alt: 2 impressions, 0 conversions
      { motifId: "alt", brandKey: "acme", seen: true, converted: false },
      { motifId: "alt", brandKey: "acme", seen: true, converted: false },
    ];

    const summary = summarizeMotifs(events);

    expect(summary.totalEvents).toBe(5);

    const heroStats = summary.stats.find(
      (s) => s.motifId === "hero" && s.brandKey === "acme"
    )!;
    expect(heroStats.impressions).toBe(3);
    expect(heroStats.conversions).toBe(2);
    expect(heroStats.conversionRate).toBeCloseTo(2 / 3);

    const altStats = summary.stats.find(
      (s) => s.motifId === "alt" && s.brandKey === "acme"
    )!;
    expect(altStats.impressions).toBe(2);
    expect(altStats.conversions).toBe(0);
    expect(altStats.conversionRate).toBe(0);
  });

  it("ranks higher-converting motifs above weaker ones for a brand", () => {
    const events: MotifEvent[] = [
      // Brand "acme"
      // hero: 3 impressions, 2 conversions → ~0.67
      { motifId: "hero", brandKey: "acme", seen: true, converted: true },
      { motifId: "hero", brandKey: "acme", seen: true, converted: false },
      { motifId: "hero", brandKey: "acme", seen: true, converted: true },

      // alt: 3 impressions, 1 conversion → ~0.33
      { motifId: "alt", brandKey: "acme", seen: true, converted: false },
      { motifId: "alt", brandKey: "acme", seen: true, converted: true },
      { motifId: "alt", brandKey: "acme", seen: true, converted: false },

      // Unrelated brand "other" for sanity
      { motifId: "hero", brandKey: "other", seen: true, converted: false },
    ];

    const summary = summarizeMotifs(events);
    const ranked = rankMotifsForBrand(summary, "acme", 2);

    expect(ranked.length).toBe(2);
    expect(ranked[0].motifId).toBe("hero");
    expect(ranked[1].motifId).toBe("alt");
    expect(ranked[0].conversionRate).toBeGreaterThan(
      ranked[1].conversionRate
    );
  });

  it("falls back to global motifs when brand has no history", () => {
    const events: MotifEvent[] = [
      // Global motifs (brandKey null)
      { motifId: "global-strong", brandKey: null, seen: true, converted: true },
      { motifId: "global-strong", brandKey: null, seen: true, converted: true },
      { motifId: "global-weak", brandKey: null, seen: true, converted: false },
      { motifId: "global-weak", brandKey: null, seen: true, converted: false },
    ];

    const summary = summarizeMotifs(events);

    const ranked = rankMotifsForBrand(summary, "unknown-brand", 1);

    expect(ranked.length).toBe(1);
    expect(ranked[0].motifId).toBe("global-strong");
    expect(ranked[0].brandKey).toBeNull();
  });

  it("returns empty list when there is no data at all", () => {
    const summary = summarizeMotifs([]);
    const ranked = rankMotifsForBrand(summary, "any-brand", 3);

    expect(summary.stats.length).toBe(0);
    expect(ranked.length).toBe(0);
  });
});
