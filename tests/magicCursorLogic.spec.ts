// tests/magicCursorLogic.spec.ts
import { describe, it, expect } from "vitest";
import { chipsForGoal } from "../client/src/pages/magicCursorLogic";

describe("Magic Cursor – chipsForGoal", () => {
  it("returns 'More minimal' for low goals", () => {
    expect(chipsForGoal(0)).toEqual(["More minimal"]);
    expect(chipsForGoal(10)).toEqual(["More minimal"]);
    expect(chipsForGoal(33)).toEqual(["More minimal"]);
  });

  it("returns 'Use email signup CTA' for mid goals", () => {
    expect(chipsForGoal(34)).toEqual(["Use email signup CTA"]);
    expect(chipsForGoal(50)).toEqual(["Use email signup CTA"]);
    expect(chipsForGoal(66)).toEqual(["Use email signup CTA"]);
  });

  it("returns both chips for high goals", () => {
    expect(chipsForGoal(67)).toEqual(["Use email signup CTA", "More minimal"]);
    expect(chipsForGoal(80)).toEqual(["Use email signup CTA", "More minimal"]);
    expect(chipsForGoal(100)).toEqual(["Use email signup CTA", "More minimal"]);
  });

  it("clamps weird goals in a sane way", () => {
    // This isn't enforced inside chipsForGoal itself, but good to
    // document expected behavior for callers that clamp 0–100.
    expect(chipsForGoal(-10)).toEqual(["More minimal"]);
    expect(chipsForGoal(999)).toEqual(["Use email signup CTA", "More minimal"]);
  });
});
