import { chipsForGoal } from "../client/src/pages/magicCursorLogic";

describe("chipsForGoal", () => {
  test("returns 'More minimal' for low goals", () => {
    expect(chipsForGoal(0)).toEqual(["More minimal"]);
    expect(chipsForGoal(10)).toEqual(["More minimal"]);
    expect(chipsForGoal(33)).toEqual(["More minimal"]);
  });

  test("returns 'Use email signup CTA' for mid goals", () => {
    expect(chipsForGoal(34)).toEqual(["Use email signup CTA"]);
    expect(chipsForGoal(50)).toEqual(["Use email signup CTA"]);
    expect(chipsForGoal(66)).toEqual(["Use email signup CTA"]);
  });

  test("returns both chips for high goals", () => {
    expect(chipsForGoal(67)).toEqual(["Use email signup CTA", "More minimal"]);
    expect(chipsForGoal(80)).toEqual(["Use email signup CTA", "More minimal"]);
    expect(chipsForGoal(100)).toEqual(["Use email signup CTA", "More minimal"]);
  });
});
