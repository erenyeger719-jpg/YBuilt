import { describe, it, expect } from "vitest";
import { seedVariants, pickVariant, recordSectionOutcome } from "../server/sections/bandits";

describe("section bandits", () => {
  it("picks only from seeded siblings and records outcomes", () => {
    const base = "hero-basic";
    const siblings = ["hero-basic","hero-basic@b","hero-basic@c"];
    seedVariants(base, "developers", siblings);
    const pick = pickVariant(base, "developers");
    expect(siblings.includes(pick)).toBe(true);
    // harmless to record; should not throw
    recordSectionOutcome(siblings, "developers", true);
  });
});
