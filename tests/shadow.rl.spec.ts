// tests/shadow.rl.spec.ts
import { describe, it, expect } from "vitest";
import {
  computeReward,
  summarizeRlRewards,
  updateProviderPriors,
  type ShadowEvent,
} from "../server/intent/shadow.rl";

describe("intent/shadow RL – reward + priors", () => {
  it("computes rewards from conversions, edits, and violations", () => {
    const clean: ShadowEvent = {
      providerId: "granite",
      route: "/act",
      converted: true,
      edits: 0,
      supViolations: 0,
    };
    expect(computeReward(clean)).toBeCloseTo(1);

    const edited: ShadowEvent = {
      providerId: "granite",
      route: "/act",
      converted: true,
      edits: 3,
      supViolations: 0,
    };
    // 1 - min(0.5, 3*0.1=0.3) = 0.7
    expect(computeReward(edited)).toBeCloseTo(0.7);

    const bad: ShadowEvent = {
      providerId: "granite",
      route: "/act",
      converted: false,
      edits: 5,
      supViolations: 3,
    };
    // 0 - min(0.5, 0.5) - min(1, 1.5) = -0.5 - 1 = -1.5
    expect(computeReward(bad)).toBeCloseTo(-1.5);
  });

  it("summarizes rewards per provider", () => {
    const events: ShadowEvent[] = [
      {
        providerId: "granite",
        route: "/act",
        converted: true,
        edits: 0,
        supViolations: 0,
      }, // 1
      {
        providerId: "granite",
        route: "/act",
        converted: false,
        edits: 2,
        supViolations: 0,
      }, // -0.2
      {
        providerId: "ollama",
        route: "/act",
        converted: true,
        edits: 4,
        supViolations: 1,
      }, // 1 - 0.4 - 0.5 = 0.1
    ];

    const summary = summarizeRlRewards(events);

    expect(summary.total).toBe(3);
    const granite = summary.providers.find(
      (p) => p.providerId === "granite"
    )!;
    expect(granite.count).toBe(2);
    expect(granite.avgReward).toBeCloseTo((1 - 0.2) / 2);

    const ollama = summary.providers.find(
      (p) => p.providerId === "ollama"
    )!;
    expect(ollama.count).toBe(1);
    expect(ollama.avgReward).toBeCloseTo(0.1);
  });

  it("updates provider priors based on average rewards", () => {
    const summary = {
      total: 2,
      providers: [
        { providerId: "granite", count: 1, avgReward: 1 },
        { providerId: "ollama", count: 1, avgReward: -0.5 },
      ],
    };

    const prior = { granite: 0, ollama: 0 };
    const updated = updateProviderPriors(prior, summary, 0.2);

    // granite: 0 + 1*0.2 = 0.2
    expect(updated.granite).toBeCloseTo(0.2);
    // ollama: 0 + (-0.5)*0.2 = -0.1
    expect(updated.ollama).toBeCloseTo(-0.1);
  });
});
