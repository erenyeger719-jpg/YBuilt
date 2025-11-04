// server/llm/provider.policy.ts

import {
  getProviderName,
  getProviderPolicy,
  type LlmProviderName,
} from "./provider.config";

export type ProviderPolicyDecisionMode = "allow" | "block" | "neutralize";

export interface ProviderCallContext {
  // Raw provider identifier (header/env/etc.).
  providerName: string | null | undefined;

  // Logical route name (e.g. "compose", "brief", "proof").
  route: string;

  // Max tokens requested by the caller.
  requestedMaxTokens: number;

  // Whether the prompt/body includes PII.
  containsPII: boolean;

  // Whether the response (or expected response) includes citations/evidence.
  responseHasCitations: boolean;

  // Whether the response (or expected response) is strict JSON.
  responseIsJson: boolean;
}

export interface ProviderPolicyDecision {
  // Normalized provider identifier ("granite" | "ollama" | "openai" | "unknown").
  provider: LlmProviderName;

  // What SUP wants to do with this call.
  // - "allow"      → call is fine as-is
  // - "neutralize" → call/output should be sanitized (e.g. strip risky parts)
  // - "block"      → call should not proceed
  mode: ProviderPolicyDecisionMode;

  // The max tokens we actually allow for this call.
  maxTokens: number;

  // Short machine-readable reason for logs/metrics.
  reason: string | null;
}

/**
 * Enforce per-provider policy for a single call, based on:
 * - route
 * - PII presence
 * - JSON-only requirement
 * - citation requirement
 * - token limits
 */
export function enforceProviderPolicy(
  ctx: ProviderCallContext
): ProviderPolicyDecision {
  const provider = getProviderName(ctx.providerName);
  const policy = getProviderPolicy(provider);

  let mode: ProviderPolicyDecisionMode = "allow";
  let reason: string | null = null;

  // 1) Route-level gating: if route is not allowed, we block outright.
  if (!policy.allowedRoutes.includes(ctx.route)) {
    mode = "block";
    reason = "route_not_allowed";
  }

  // 2) PII rules: if PII is present but provider is not allowed to see it.
  if (mode === "allow" && ctx.containsPII && !policy.allowPII) {
    mode = "block";
    reason = "pii_not_allowed";
  }

  // 3) JSON-only requirement: neutralize non-JSON responses.
  if (mode === "allow" && policy.jsonOnly && !ctx.responseIsJson) {
    mode = "neutralize";
    reason = "json_only_required";
  }

  // 4) Citation requirement: neutralize when citations are missing.
  if (
    (mode === "allow" || mode === "neutralize") &&
    policy.requireCitations &&
    !ctx.responseHasCitations
  ) {
    mode = "neutralize";
    if (!reason) {
      reason = "citations_required_missing";
    }
  }

  // 5) Token clamp: even when neutralized we cap tokens; when blocked → 0.
  const maxTokens =
    mode === "block"
      ? 0
      : Math.max(0, Math.min(ctx.requestedMaxTokens, policy.maxTokens));

  return {
    provider,
    mode,
    maxTokens,
    reason,
  };
}
