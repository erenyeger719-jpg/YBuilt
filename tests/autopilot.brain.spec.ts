// tests/autopilot.brain.spec.ts
import { describe, it, expect } from "vitest";
// IMPORTANT: if your function name is different, update this import.
import { planFromUtterance } from "../client/src/lib/autopilot.ts";

function lowerJson(x: unknown): string {
  try {
    return JSON.stringify(x).toLowerCase();
  } catch {
    return "";
  }
}

describe("Autopilot brain – planFromUtterance", () => {
  it("handles 'make a dark waitlist page' without crashing and encodes intent", () => {
    const text =
      "Make a dark waitlist page for indie founders with a hero and email capture.";

    const plan = planFromUtterance(text);

    expect(plan).toBeTruthy();
    expect(typeof plan).toBe("object");

    const blob = lowerJson(plan);

    // should mention waitlist and dark somewhere in the plan shape
    expect(blob).toContain("waitlist");
    expect(blob).toContain("dark");
    // and ideally some hint of sections or hero
    expect(blob.includes("hero") || blob.includes("section")).toBe(true);
  });

  it("handles 'test headline and stop at 95%' and encodes A/B intent", () => {
    const text =
      "Test the main headline and auto-stop when you're 95% confident which version wins.";

    const plan = planFromUtterance(text);

    expect(plan).toBeTruthy();
    expect(typeof plan).toBe("object");

    const blob = lowerJson(plan);

    // should look like an A/B-style / experiment-style plan
    expect(
      blob.includes("ab") ||
        blob.includes("a/b") ||
        blob.includes("experiment") ||
        blob.includes("variant")
    ).toBe(true);

    // confidence should appear in some shape (0.95, 95, 95%)
    expect(
      blob.includes("0.95") ||
        blob.includes("95%") ||
        blob.includes("95") // fallback
    ).toBe(true);
  });

  it("handles 'wire email capture and send welcome' and encodes email flow", () => {
    const text =
      "Wire the email capture form and send a welcome email to new signups.";

    const plan = planFromUtterance(text);

    expect(plan).toBeTruthy();
    expect(typeof plan).toBe("object");

    const blob = lowerJson(plan);

    // mention email + welcome somewhere inside plan details
    expect(blob).toContain("email");
    expect(blob).toContain("welcome");

    // should look like some kind of flow / action, not just raw text
    expect(
      blob.includes("flow") ||
        blob.includes("action") ||
        blob.includes("trigger")
    ).toBe(true);
  });

  it("does not crash on unclear / messy input (returns something usable)", () => {
    const text =
      "uhhh like make it nice but not too much, maybe idk change stuff a bit?";

    const plan = planFromUtterance(text);

    // key guarantee: planner never throws and returns *some* plan
    expect(plan).toBeTruthy();
    expect(typeof plan).toBe("object");
  });
});
