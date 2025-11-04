// tests/llm.provider.config.spec.ts
import { describe, it, expect } from "vitest";
import {
  getProviderName,
  getProviderPolicy,
  isRouteAllowed,
  type LlmProviderName,
} from "../server/llm/provider.config";

describe("llm/provider.config – provider policies", () => {
  it("normalizes raw provider names into known identifiers", () => {
    expect(getProviderName("Granite-1.0")).toBe("granite");
    expect(getProviderName("ollama")).toBe("ollama");
    expect(getProviderName("OPENAI")).toBe("openai");
    expect(getProviderName("weird-provider")).toBe("unknown");
    expect(getProviderName(null)).toBe("unknown");
  });

  it("returns a sane policy for known providers", () => {
    const names: LlmProviderName[] = ["granite", "ollama", "openai"];

    for (const name of names) {
      const policy = getProviderPolicy(name);

      expect(policy.maxTokens).toBeGreaterThan(0);
      expect(Array.isArray(policy.allowedRoutes)).toBe(true);
      expect(policy.allowedRoutes.length).toBeGreaterThan(0);
      expect(typeof policy.allowPII).toBe("boolean");
      expect(typeof policy.requireCitations).toBe("boolean");
      expect(typeof policy.jsonOnly).toBe("boolean");
    }
  });

  it("falls back to a deny-by-default policy for unknown providers", () => {
    const policy = getProviderPolicy("some-new-thing");

    expect(policy.maxTokens).toBe(0);
    expect(policy.allowedRoutes.length).toBe(0);
    expect(policy.allowPII).toBe(false);
  });

  it("checks whether a route is allowed for a given provider", () => {
    expect(isRouteAllowed("granite", "compose")).toBe(true);
    expect(isRouteAllowed("granite", "totally_fake_route")).toBe(false);

    // Unknown providers should not be allowed on any route.
    expect(isRouteAllowed("mystery", "compose")).toBe(false);
  });
});
