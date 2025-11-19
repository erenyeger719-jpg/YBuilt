// server/llm/routing.roles.ts

import type { ProviderId } from "./provider.config";

export type LLMRole =
  | "compose_main"
  | "compose_alt"
  | "deep_reasoning"
  | "code_main"
  | "long_context"
  | "cheap_bulk"
  | "simplify"
  | "realtime_news"
  | "creative";

export const LLM_ROUTING: Record<LLMRole, ProviderId> = {
  // 1) Main page composer – balanced quality/cost
  compose_main: "openai-4o",          // GPT-4o

  // 2) Alternative “writer” brain – very strong writing/coding
  compose_alt: "claude-sonnet-35",    // Claude 3.5 Sonnet (cheaper than 4.5)

  // 3) Deep reasoning / high-stakes stuff
  deep_reasoning: "openai-5",         // GPT-5 / frontier slot

  // 4) Coding tasks
  code_main: "claude-sonnet-45",      // Claude 4.5 Sonnet – coding beast

  // 5) Huge briefs / many docs
  long_context: "gemini-25-pro",      // Gemini 2.5 Pro – long context

  // 6) Cheap bulk: tags, alt text, variants, classification
  cheap_bulk: "gemini-25-flash",      // Gemini 2.5 Flash – fast & cheap

  // 7) Simplify / clean / summarize input (Granite instead of Ollama)
  simplify: "granite-4-simplify",     // Granite 4.0 – cheap, local-friendly

  // 8) Real-time / news sections
  realtime_news: "grok-4",            // Grok 4 – live web brain

  // 9) Creative / spicy mode
  creative: "grok-4",                 // or "claude-sonnet-35" if you want softer tone
};

// Small helper: get the provider for a given role
export function getProviderForRole(role: LLMRole): ProviderId {
  return LLM_ROUTING[role];
}
