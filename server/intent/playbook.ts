// server/intent/playbook.ts
import { normalizeKey } from "./cache.ts";

type Intent = {
  audience?: string;
  goal?: "waitlist" | "demo" | "purchase" | "contact";
  industry?: "saas" | "ecommerce" | "portfolio" | "";
  vibe?: "minimal" | "playful" | "serious";
  color_scheme?: "dark" | "light" | "";
  sections: string[];
};

type Fit = {
  intent: Intent;
  confidence: number;
  chips?: string[];
  brandColor?: string;
  copy?: Record<string, string>;
};

function rule(
  when: (p: string) => boolean,
  out: Omit<Fit, "confidence">
): Fit | null {
  return { ...out, confidence: 0.9 };
}

export function pickFromPlaybook(prompt = ""): Fit | null {
  const p = normalizeKey(prompt);
  const has = (w: string) => p.includes(w);

  // 1) Dark SaaS waitlist (the flagship)
  if (has("dark") && has("saas") && (has("waitlist") || has("signup"))) {
    return rule(() => true, {
      intent: {
        industry: "saas",
        goal: "waitlist",
        vibe: "minimal",
        color_scheme: "dark",
        sections: ["hero-basic", "cta-simple"].concat(has("feature") ? ["features-3col"] : []),
      },
      brandColor: "#6d28d9", // purple
      chips: ["Add 3-card features", "Use email signup CTA", "Switch to light"],
    });
  }

  // 2) Portfolio (creator/freelancer)
  if (has("portfolio")) {
    return rule(() => true, {
      intent: {
        industry: "portfolio",
        goal: "contact",
        vibe: has("playful") ? "playful" : "minimal",
        color_scheme: has("dark") ? "dark" : "light",
        sections: ["hero-basic", "features-3col", "cta-simple"],
      },
      brandColor: "#2563eb", // blue
      chips: ["Use email signup CTA", has("dark") ? "Switch to light" : "Use dark mode", "Add 3-card features"],
    });
  }

  // 3) Ecommerce "buy" landing
  if (has("ecommerce") || has("buy") || has("purchase")) {
    return rule(() => true, {
      intent: {
        industry: "ecommerce",
        goal: "purchase",
        vibe: "serious",
        color_scheme: has("dark") ? "dark" : "light",
        sections: ["hero-basic", "features-3col", "cta-simple"],
      },
      brandColor: "#16a34a", // green
      chips: ["Add 3-card features", "Use email signup CTA"],
    });
  }

  return null;
}
