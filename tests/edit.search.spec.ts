// tests/edit.search.spec.ts
import { describe, it, expect } from "vitest";
import {
  editSearch,
  failureAwareSearch,
  type EditAttempt,
  type EditCandidate,
} from "../server/qa/edit.search";

describe("qa/edit.search – failureAwareSearch", () => {
  const fixes: EditCandidate[] = [
    { id: "fix_a11y", tags: ["a11y"], risk: 0.1 },
    { id: "fix_perf", tags: ["perf"], risk: 0.2 },
    { id: "fix_generic", risk: 0.3 },
  ];

  it("picks lowest-risk fix on first attempt", () => {
    const attempts: EditAttempt[] = [];

    const decision = failureAwareSearch(attempts, fixes);

    expect(decision.stop).toBe(false);
    expect(decision.next?.id).toBe("fix_a11y");
  });

  it("prefers fixes tagged for the last failure reason", () => {
    const attempts: EditAttempt[] = [
      { fixId: "fix_perf", success: false, reason: "a11y" },
    ];

    const decision = failureAwareSearch(attempts, fixes);

    expect(decision.stop).toBe(false);
    // We failed for "a11y" and haven't tried fix_a11y yet → pick that.
    expect(decision.next?.id).toBe("fix_a11y");
  });

  it("stops when maxAttempts of failures is reached", () => {
    const attempts: EditAttempt[] = [
      { fixId: "fix_a11y", success: false, reason: "a11y" },
      { fixId: "fix_perf", success: false, reason: "perf" },
      { fixId: "fix_generic", success: false, reason: "other" },
    ];

    const decision = failureAwareSearch(attempts, fixes, 3);

    expect(decision.stop).toBe(true);
    expect(decision.next).toBeNull();
  });

  it("stops when no untried fixes remain even if maxAttempts is higher", () => {
    const attempts: EditAttempt[] = [
      { fixId: "fix_a11y", success: false, reason: "a11y" },
      { fixId: "fix_perf", success: false, reason: "perf" },
      { fixId: "fix_generic", success: false, reason: "other" },
    ];

    const decision = failureAwareSearch(attempts, fixes, 10);

    expect(decision.stop).toBe(true);
    expect(decision.next).toBeNull();
  });
});

describe("qa/edit.search – editSearch smoke test", () => {
  it("returns a structured result and never throws", async () => {
    const res = await editSearch({
      spec: {
        brand: { tone: "playful", dark: true },
        layout: { sections: ["hero", "features-3col"] },
      },
      copy: {
        HEADLINE: "A headline that probably needs some polishing",
        BODY: "Some body copy that is long enough to be scored for readability.",
      },
    });

    expect(res).toBeDefined();
    expect(typeof res.better).toBe("boolean");
    expect(res.spec).toBeTruthy();
    expect(Array.isArray(res.applied)).toBe(true);
  });
});
