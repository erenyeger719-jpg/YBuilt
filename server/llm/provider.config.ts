// server/llm/provider.config.ts

export type LlmProviderName = "granite" | "ollama" | "openai" | "unknown";

export interface ProviderPolicy {
  // Hard cap on tokens per call.
  maxTokens: number;
  // Which logical routes this provider is allowed to serve.
  allowedRoutes: string[];
  // Whether this provider is allowed to see PII.
  allowPII: boolean;
  // Whether we expect citations / evidence mode from this provider.
  requireCitations: boolean;
  // Whether we expect strict JSON-only responses.
  jsonOnly: boolean;
}

// You can tweak these numbers later; these are just sane defaults.
const PROVIDER_POLICIES: Record<LlmProviderName, ProviderPolicy> = {
  granite: {
    maxTokens: 4096,
    allowedRoutes: [
      "brief",
      "planner",
      "compose",
      "critic",
      "proof",
    ],
    allowPII: false,
    requireCitations: true,
    jsonOnly: true,
  },
  ollama: {
    maxTokens: 2048,
    allowedRoutes: [
      "brief",
      "planner",
      "compose",
    ],
    allowPII: true, // local box usually
    requireCitations: false,
    jsonOnly: true,
  },
  openai: {
    maxTokens: 4096,
    allowedRoutes: [
      "brief",
      "planner",
      "compose",
      "critic",
    ],
    allowPII: false,
    requireCitations: false,
    jsonOnly: true,
  },
  unknown: {
    maxTokens: 0,
    allowedRoutes: [],
    allowPII: false,
    requireCitations: false,
    jsonOnly: true,
  },
};

/**
 * Normalize arbitrary strings into a known provider name.
 */
export function getProviderName(
  raw: string | null | undefined
): LlmProviderName {
  if (!raw) return "unknown";
  const name = raw.trim().toLowerCase();

  if (name.startsWith("granite")) return "granite";
  if (name.startsWith("ollama")) return "ollama";
  if (name.startsWith("openai")) return "openai";

  return "unknown";
}

/**
 * Look up the ProviderPolicy for a raw provider name.
 * Unknown providers fall back to a deny-by-default policy.
 */
export function getProviderPolicy(
  rawName: string | null | undefined
): ProviderPolicy {
  const name = getProviderName(rawName);
  return PROVIDER_POLICIES[name];
}

/**
 * Convenience helper: check if a logical route is allowed
 * for a given provider name.
 */
export function isRouteAllowed(
  rawName: string | null | undefined,
  route: string
): boolean {
  const policy = getProviderPolicy(rawName);
  return policy.allowedRoutes.includes(route);
}
