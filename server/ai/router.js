// server/ai/router.js
// Choose model by task + tier. Swap here when you add providers.
export function pickModel(task, tier = "balanced") {
  // tiers: "fast" (cheap/quick), "balanced", "best" (highest quality)
  const map = {
    fast: {
      planner:   { provider: "openai", model: "gpt-4o-mini" },
      coder:     { provider: "openai", model: "gpt-4o-mini" },
      critic:    { provider: "openai", model: "gpt-4o-mini" },
    },
    balanced: {
      planner:   { provider: "openai", model: "gpt-4o-mini" }, // quick, coherent
      coder:     { provider: "openai", model: "gpt-4o" },      // stronger codegen
      critic:    { provider: "openai", model: "gpt-4o-mini" }, // cheap pass
    },
    best: {
      // Swap these later if you add Anthropic/Gemini:
      // planner: { provider: "anthropic", model: "claude-3-5-sonnet" },
      // coder:   { provider: "openai", model: "gpt-4.1" },
      // critic:  { provider: "google", model: "gemini-1.5-pro" },
      planner:   { provider: "openai", model: "gpt-4o" },
      coder:     { provider: "openai", model: "gpt-4o" },
      critic:    { provider: "openai", model: "gpt-4o" },
    },
  };
  const tierMap = map[tier] || map.balanced;
  return tierMap[task] || tierMap.coder;
}
