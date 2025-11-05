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
    allowedRoutes: ["brief", "planner", "compose", "critic", "proof"],
    allowPII: false,
    requireCitations: true,
    jsonOnly: true,
  },
  ollama: {
    maxTokens: 2048,
    allowedRoutes: ["brief", "planner", "compose"],
    allowPII: true, // local box usually
    requireCitations: false,
    jsonOnly: true,
  },
  openai: {
    maxTokens: 4096,
    allowedRoutes: ["brief", "planner", "compose", "critic"],
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
  raw: string | null | undefined,
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
  rawName: string | null | undefined,
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
  route: string,
): boolean {
  const policy = getProviderPolicy(rawName);
  return policy.allowedRoutes.includes(route);
}

// ---------------------------------------------------------------------------
// Model-level config (for SUP + routing)
// ---------------------------------------------------------------------------

export type ProviderId =
  | "openai-4o"
  | "openai-5"
  | "openai-4o-mini"
  | "claude-sonnet-45"
  | "claude-sonnet-35"
  | "gemini-25-pro"
  | "gemini-25-flash"
  | "grok-4"
  | "grok-4-heavy"
  | "granite-4-simplify";

export type ProviderFamily =
  | "openai"
  | "anthropic"
  | "gemini"
  | "grok"
  | "granite";

export type PriceTier = "cheap" | "mid" | "expensive";

export interface ProviderConfig {
  id: ProviderId;
  family: ProviderFamily;
  model: string;
  maxTokens: number;
  priceTier: PriceTier;
}

/**
 * Catalog of concrete model IDs SUP/router can choose from.
 * These are intentionally coarse (id + family + price tier) so callers
 * don’t need to know vendor-specific details everywhere.
 */
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  // 🧠 OpenAI – generalist / frontier

  "openai-4o": {
    id: "openai-4o",
    family: "openai",
    model: "gpt-4o",
    maxTokens: 128_000,
    priceTier: "mid",
  },
  "openai-5": {
    id: "openai-5",
    family: "openai",
    model: "gpt-5",
    maxTokens: 400_000,
    priceTier: "expensive",
  },
  "openai-4o-mini": {
    id: "openai-4o-mini",
    family: "openai",
    model: "gpt-4o-mini",
    maxTokens: 32_000,
    priceTier: "cheap",
  },

  // 📝 Anthropic – writer / coder

  "claude-sonnet-45": {
    id: "claude-sonnet-45",
    family: "anthropic",
    model: "claude-3.5-sonnet-4.5",
    maxTokens: 200_000,
    priceTier: "expensive",
  },
  "claude-sonnet-35": {
    id: "claude-sonnet-35",
    family: "anthropic",
    model: "claude-3.5-sonnet",
    maxTokens: 200_000,
    priceTier: "mid",
  },

  // 📚 Google – long context + cheap bulk

  "gemini-25-pro": {
    id: "gemini-25-pro",
    family: "gemini",
    model: "gemini-2.5-pro",
    maxTokens: 1_000_000,
    priceTier: "mid",
  },
  "gemini-25-flash": {
    id: "gemini-25-flash",
    family: "gemini",
    model: "gemini-2.5-flash",
    maxTokens: 1_000_000,
    priceTier: "cheap",
  },

  // 🌶 Grok – realtime + creative

  "grok-4": {
    id: "grok-4",
    family: "grok",
    model: "grok-4",
    maxTokens: 256_000,
    priceTier: "mid",
  },
  "grok-4-heavy": {
    id: "grok-4-heavy",
    family: "grok",
    model: "grok-4-heavy",
    maxTokens: 256_000,
    priceTier: "expensive",
  },

  // 🧹 Granite – simplifier (replaces Ollama simplifier)

  "granite-4-simplify": {
    id: "granite-4-simplify",
    family: "granite",
    model: "granite-4.0-nano-instruct",
    maxTokens: 128_000,
    priceTier: "cheap",
  },
};
