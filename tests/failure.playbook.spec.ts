// tests/failure.playbook.spec.ts
import { describe, it, expect } from "vitest";
import {
  pickFailureFallback,
  type FailureContext,
} from "../server/qa/failure.playbook";

describe("qa/failure.playbook – pickFailureFallback", () => {
  it("returns a structured fallback for known kinds", () => {
    const kinds: FailureContext["kind"][] = [
      "sup_block",
      "contracts_failed",
      "quota_exceeded",
      "body_too_large",
      "abuse_detected",
      "internal_error",
    ];

    for (const kind of kinds) {
      const res = pickFailureFallback({ kind, route: "/one" });

      expect(res.status).toBe("fallback");
      expect(typeof res.code).toBe("string");
      expect(res.code.length).toBeGreaterThan(0);

      expect(typeof res.title).toBe("string");
      expect(res.title.length).toBeGreaterThan(0);

      expect(typeof res.body).toBe("string");
      expect(res.body.length).toBeGreaterThan(0);

      expect(typeof res.retryable).toBe("boolean");
    }
  });

  it("is deterministic for the same input", () => {
    const ctx: FailureContext = {
      kind: "sup_block",
      route: "/instant",
      reason: "claims",
      audience: "founder",
    };

    const a = pickFailureFallback(ctx);
    const b = pickFailureFallback(ctx);

    expect(a).toEqual(b);
  });

  it("uses reason to refine sup_block codes when available", () => {
    const withReason = pickFailureFallback({
      kind: "sup_block",
      reason: "claims",
    });

    const generic = pickFailureFallback({
      kind: "sup_block",
    });

    expect(withReason.code).toBe("sup_block.claims");
    expect(generic.code).toBe("sup_block.generic");
  });

  it("falls back to a generic unknown bucket for unrecognized kinds", () => {
    const res = pickFailureFallback({
      kind: "totally_made_up_kind",
      route: "/one",
    });

    expect(res.code).toBe("unknown.generic");
    expect(res.retryable).toBe(true);
  });
});
