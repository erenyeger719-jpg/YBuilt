// server/intent/playbook.ts
import { defaultsForSections, SectionId } from "./dsl.ts";
import { normalizeKey } from "./cache.ts";

type Play = {
  when: RegExp;
  intent: {
    sections: SectionId[];
    vibe?: "minimal" | "bold" | "playful" | "serious";
    dark?: boolean;
    audience?: string;
    goal?: string;
    industry?: string;
  };
  brandColor?: string;
  copy?: Record<string, string>;
};

const PLAYS: Play[] = [
  {
    when: /saas.*dark.*(dev|developer)/,
    intent: {
      sections: ["hero-basic", "cta-simple"],
      vibe: "minimal",
      dark: true,
      audience: "developers",
      goal: "waitlist",
      industry: "saas",
    },
    brandColor: "#7c3aed",
  },
  {
    when: /(e-?commerce|shop).*(dark|bold)/,
    intent: {
      sections: ["hero-basic", "features-3col", "cta-simple"],
      vibe: "bold",
      dark: true,
      audience: "shoppers",
      goal: "purchase",
      industry: "ecommerce",
    },
    brandColor: "#ef4444",
  },
  {
    when: /portfolio.*(designer|photographer)/,
    intent: {
      sections: ["hero-basic", "features-3col", "cta-simple"],
      vibe: "minimal",
      dark: false,
      audience: "clients",
      goal: "contact",
      industry: "portfolio",
    },
    brandColor: "#111827",
  },
];

export function pickFromPlaybook(prompt: string) {
  const key = normalizeKey(prompt);
  for (const p of PLAYS) {
    if (p.when.test(key)) {
      const sections = p.intent.sections;
      const copy = { ...defaultsForSections(sections), ...(p.copy || {}) };
      return {
        intent: {
          audience: p.intent.audience || "",
          goal: p.intent.goal || "",
          industry: p.intent.industry || "",
          vibe: p.intent.vibe || "serious",
          color_scheme: p.intent.dark ? "dark" : "light",
          density: p.intent.vibe === "minimal" ? "minimal" : "",
          complexity: "simple",
          sections,
        },
        confidence: 0.8,
        chips: [
          p.intent.dark ? "Switch to light" : "Use dark mode",
          p.intent.vibe === "minimal" ? "More content" : "Keep it minimal",
          p.intent.goal === "waitlist" ? "Use email signup CTA" : "Use waitlist",
        ],
        brandColor: p.brandColor || "#6d28d9",
        copy,
      };
    }
  }
  return null;
}
