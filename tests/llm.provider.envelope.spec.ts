// tests/llm.provider.envelope.spec.ts
import { describe, it, expect } from "vitest";
import {
  providerPolicyFor,
  enforceProviderRequestPolicy,
  type ProviderRequestContext,
} from "../server/llm/provider.envelope";

describe("llm/provider – compliance envelope", () => {
  it("returns a minimal policy for unknown providers", () => {
    const policy = providerPolicyFor("weird-provider");

    expect(policy.id).toBe("weird-provider");
    expect(policy.maxTokens).toBeUndefined();
    expect(policy.allowedRoutes).toBeUndefined();
    expect(policy.piiAllowed).toBeUndefined();
    expect(policy.evidenceRequired).toBeUndefined();
  });

  it("clamps maxTokens and allows only configured routes", () => {
    const okCtx: ProviderRequestContext = {
      providerId: "granite",
      route: "/act",
      requestedMaxTokens: 99999,
      containsPII: false,
    };

    const okDecision = enforceProviderRequestPolicy(okCtx);

    expect(okDecision.ok).toBe(true);
    // granite policy maxTokens = 4096
    expect(okDecision.maxTokens).toBe(4096);
    expect(okDecision.evidenceRequired).toBe(true);

    const badRouteCtx: ProviderRequestContext = {
      providerId: "granite",
      route: "/totally-weird",
      requestedMaxTokens: 100,
      containsPII: false,
    };

    const badDecision = enforceProviderRequestPolicy(badRouteCtx);

    expect(badDecision.ok).toBe(false);
    expect(badDecision.reason).toBe("route_not_allowed");
  });

  it("blocks PII when provider does not allow it", () => {
    const ctx: ProviderRequestContext = {
      providerId: "ollama",
      route: "/act",
      requestedMaxTokens: 512,
      containsPII: true,
    };

    const decision = enforceProviderRequestPolicy(ctx);

    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe("pii_not_allowed");
    // ollama policy: evidenceRequired = false
    expect(decision.evidenceRequired).toBe(false);
  });
});
