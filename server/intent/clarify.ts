// server/intent/clarify.ts
import { normalizeKey } from "./cache.ts";

type SpecLike = {
  brand?: { dark?: boolean; tone?: string; tier?: string };
  layout?: { sections?: string[] };
};

export function clarifyChips({ prompt = "", spec = {} as SpecLike }) {
  const p = normalizeKey(prompt);
  const has = (w: string) => p.includes(w);

  const chips: string[] = [];

  // Mode (dark/light) → use what's missing from prompt/spec
  const darkFromSpec = !!spec?.brand?.dark;
  const modeMentioned = has("dark") || has("light");
  if (!modeMentioned) chips.push(darkFromSpec ? "Switch to light" : "Use dark mode");

  // Tone → nudge towards minimal if absent
  const tone = (spec?.brand?.tone || "").toLowerCase();
  if (!tone && !has("minimal") && !has("playful")) chips.push("More minimal");

  // Sections → add features 3-col if not present
  const sections = Array.isArray(spec?.layout?.sections) ? spec.layout.sections : [];
  const hasFeatures = sections.includes("features-3col") || has("feature");
  if (!hasFeatures) chips.push("Add 3-card features");

  // CTA → pick one based on prompt (defaults to email signup)
  if (has("waitlist")) chips.push("Use waitlist");
  else chips.push("Use email signup CTA");

  // ---- Style tier chips & premium nudge ----
  const tier = String((spec as any)?.brand?.tier || "").toLowerCase();

  // If prompt hints at a specific style, surface a direct switch chip
  if (has("premium") && tier !== "premium") chips.unshift("Use premium style");
  if (has("brutalist") && tier !== "brutalist") chips.push("Use brutalist style");
  if (has("playful") && tier !== "playful") chips.push("Use playful style");
  if (has("minimal") && tier !== "minimal") chips.push("Use minimal style");

  // Nudge to premium when unclear (or currently minimal)
  if (!tier || tier === "minimal") chips.unshift("Use premium style");

  // Compact: unique + first 3
  return Array.from(new Set(chips)).slice(0, 3);
}
