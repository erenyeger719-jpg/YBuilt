// tests/llm.provider.policy.spec.ts
import { describe, it, expect } from "vitest";
import {
  enforceProviderPolicy,
} from "../server/llm/provider.policy";

describe("llm/provider.policy – enforcement wrapper around provider config", () => {
  it("allows a compliant Granite call and clamps max tokens", () => {
    const decision = enforceProviderPolicy({
      providerName: "granite",
      route: "compose",
      requestedMaxTokens: 99999,
      containsPII: false,
      responseHasCitations: true,
      responseIsJson: true,
    });

    expect(decision.provider).toBe("granite");
    expect(decision.mode).toBe("allow");
    expect(decision.maxTokens).toBeGreaterThan(0);
    expect(decision.maxTokens).toBeLessThanOrEqual(99999);
  });

  it("blocks calls on routes not allowed for the provider", () => {
    const decision = enforceProviderPolicy({
      providerName: "granite",
      route: "totally_fake_route",
      requestedMaxTokens: 1000,
      containsPII: false,
      responseHasCitations: true,
      responseIsJson: true,
    });

    expect(decision.mode).toBe("block");
    expect(decision.maxTokens).toBe(0);
    expect(decision.reason).toBe("route_not_allowed");
  });

  it("blocks PII when provider does not allow it", () => {
    const decision = enforceProviderPolicy({
      providerName: "openai",
      route: "compose",
      requestedMaxTokens: 500,
      containsPII: true,
      responseHasCitations: false,
      responseIsJson: true,
    });

    expect(decision.provider).toBe("openai");
    expect(decision.mode).toBe("block");
    expect(decision.reason).toBe("pii_not_allowed");
    expect(decision.maxTokens).toBe(0);
  });

  it("neutralizes responses that violate json-only or citation requirements", () => {
    // Missing JSON → json_only_required
    const jsonDecision = enforceProviderPolicy({
      providerName: "granite",
      route: "compose",
      requestedMaxTokens: 500,
      containsPII: false,
      responseHasCitations: true,
      responseIsJson: false,
    });

    expect(jsonDecision.mode).toBe("neutralize");
    expect(jsonDecision.reason).toBe("json_only_required");
    expect(jsonDecision.maxTokens).toBeGreaterThan(0);

    // Missing citations → citations_required_missing
    const citationDecision = enforceProviderPolicy({
      providerName: "granite",
      route: "compose",
      requestedMaxTokens: 500,
      containsPII: false,
      responseHasCitations: false,
      responseIsJson: true,
    });

    expect(citationDecision.mode).toBe("neutralize");
    expect(citationDecision.reason).toBe("citations_required_missing");
    expect(citationDecision.maxTokens).toBeGreaterThan(0);
  });

  it("treats unknown providers as blocked by default", () => {
    const decision = enforceProviderPolicy({
      providerName: "some-new-thing",
      route: "compose",
      requestedMaxTokens: 1000,
      containsPII: false,
      responseHasCitations: true,
      responseIsJson: true,
    });

    expect(decision.provider).toBe("unknown");
    expect(decision.mode).toBe("block");
    expect(decision.maxTokens).toBe(0);
  });
});
