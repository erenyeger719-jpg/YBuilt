// server/intent/copy.ts
import { pickPhrase } from "./phrases.ts";

type Intent = {
  goal?: "waitlist" | "demo" | "purchase" | "contact";
  vibe?: "minimal" | "playful" | "serious";
  color_scheme?: "dark" | "light" | "";
  sections?: string[];
};

export function guessBrand(intent: Intent = {}): string {
  // minimal heuristics; safe hex only
  if (intent.color_scheme === "dark") {
    return intent.vibe === "playful" ? "#a855f7" : "#6d28d9"; // purple family
  }
  if (intent.vibe === "serious") return "#2563eb"; // blue
  if (intent.vibe === "playful") return "#f59e0b"; // amber
  return "#6d28d9";
}

export function cheapCopy(prompt = "", intent: Intent = {}): Record<string, string> {
  const base = {
    HERO_TITLE: pickPhrase("HERO_TITLE", intent),
    HERO_SUB:   pickPhrase("HERO_SUB", intent),
    CTA_LABEL:  pickPhrase("CTA_LABEL", intent),
    CTA_HEAD:   pickPhrase("CTA_HEAD", intent),
    F1_TITLE:   pickPhrase("F1_TITLE", intent),
    F1_SUB:     pickPhrase("F1_SUB", intent),
    F2_TITLE:   pickPhrase("F2_TITLE", intent),
    F2_SUB:     pickPhrase("F2_SUB", intent),
    F3_TITLE:   pickPhrase("F3_TITLE", intent),
    F3_SUB:     pickPhrase("F3_SUB", intent),
  };

  // tiny, deterministic seasoning from prompt (nouny words, no stopwords)
  const words = (String(prompt).toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((w) => !["for", "to", "the", "a", "an", "and", "or", "with", "of", "on", "in"].includes(w));
  const topic = words.slice(0, 2).join(" "); // e.g. "saas landing"
  if (topic) {
    base.HERO_SUB = (base.HERO_SUB || "").replace("pages", topic); // "Craft high-quality saas landing with measurable outcomes."
  }

  // strip any falsy leftovers (composer already cleans placeholders)
  return Object.fromEntries(Object.entries(base).filter(([, v]) => v));
}
