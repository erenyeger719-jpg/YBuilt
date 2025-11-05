// server/llm/provider.envelope.ts

import {
  enforceProviderPolicy,
  type ProviderCallContext,
  type ProviderPolicyDecision,
} from "./provider.policy";

export type ProviderId = string;

export interface ProviderPolicy {
  id: ProviderId;
  maxTokens?: number;
  allowedRoutes?: string[];
  piiAllowed?: boolean;
  evidenceRequired?: boolean;
}

// Simple static policy map.
// These can be tuned later or driven by env/config, but this is enough
// for enforcement + tests.
const PROVIDER_POLICIES: ProviderPolicy[] = [
  {
    id: "granite",
    maxTokens: 4096,
    allowedRoutes: ["/act", "/review", "/one", "/instant"],
    piiAllowed: false,
    evidenceRequired: true,
  },
  {
    id: "ollama",
    maxTokens: 2048,
    allowedRoutes: ["/act", "/review"],
    piiAllowed: false,
    evidenceRequired: false,
  },
  {
    id: "openai",
    maxTokens: 4096,
    allowedRoutes: ["/act", "/review", "/one", "/instant", "/media"],
    piiAllowed: false,
    evidenceRequired: true,
  },
];

export function providerPolicyFor(id: ProviderId): ProviderPolicy {
  const found = PROVIDER_POLICIES.find((p) => p.id === id);
  return found || { id };
}

export interface ProviderRequestContext {
  providerId: ProviderId;
  route: string;
  requestedMaxTokens?: number | null;
  // High-level hint – upstream PII scrubber can set this if it saw PII.
  containsPII?: boolean;
}

export interface ProviderRequestDecision {
  ok: boolean;
  reason?: string;
  maxTokens?: number;
  evidenceRequired: boolean;
}

/**
 * Enforce simple per-provider policy for a given request.
 * This does NOT call any providers – it just decides:
 * - Is this call allowed?
 * - What maxTokens should we actually send?
 * - Should we run in "evidence / citations required" mode?
 */
export function enforceProviderRequestPolicy(
  ctx: ProviderRequestContext
): ProviderRequestDecision {
  const policy = providerPolicyFor(ctx.providerId);

  let ok = true;
  let reason: string | undefined;

  // Route restriction: if provider specifies allowedRoutes, enforce it.
  if (policy.allowedRoutes && policy.allowedRoutes.length > 0) {
    if (!policy.allowedRoutes.includes(ctx.route)) {
      ok = false;
      reason = "route_not_allowed";
    }
  }

  // PII restriction: if provider forbids PII, block when PII is present.
  if (ok && policy.piiAllowed === false && ctx.containsPII) {
    ok = false;
    reason = "pii_not_allowed";
  }

  // Clamp tokens to provider maxTokens when set.
  let maxTokens: number | undefined;
  const requested = ctx.requestedMaxTokens;

  if (policy.maxTokens != null) {
    if (typeof requested === "number" && Number.isFinite(requested)) {
      maxTokens = Math.min(requested, policy.maxTokens);
    } else {
      maxTokens = policy.maxTokens;
    }
  } else if (typeof requested === "number" && Number.isFinite(requested)) {
    maxTokens = requested;
  }

  const evidenceRequired = !!policy.evidenceRequired;

  return {
    ok,
    reason,
    maxTokens,
    evidenceRequired,
  };
}

/**
 * Thin wrapper so the rest of the codebase can ask:
 * "Given this provider + route + context, what should SUP do?"
 *
 * It just delegates to enforceProviderPolicy from provider.policy.ts.
 */
export function decideProviderEnvelope(
  ctx: ProviderCallContext
): ProviderPolicyDecision {
  return enforceProviderPolicy(ctx);
}
