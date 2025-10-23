// client/src/lib/templates.ts
export type TemplateDef = {
  id: string;
  name: string;
  desc: string;
  prompt: string;     // what we send to aiScaffold
  blocks?: string[];  // default sections to generate
  thumb?: string;     // we’ll hook up later
};

export const TEMPLATES: TemplateDef[] = [
  {
    id: "saas-starter",
    name: "SaaS Starter",
    desc: "Hero, features, pricing, CTA. Clean, modern.",
    prompt:
      "Build a SaaS landing page with a bold hero, 3 feature cards, a simple pricing table (3 tiers), FAQ, and a final CTA. Keep HTML/CSS vanilla, responsive, minimal JS.",
    blocks: ["hero", "features", "pricing", "faq", "cta"],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    desc: "Intro + project grid + contact.",
    prompt:
      "Create a personal portfolio landing page with a hero intro, a responsive project grid (6 items), testimonials, and a simple contact CTA. Plain HTML/CSS; tasteful typography.",
    blocks: ["hero", "features", "testimonials", "cta"],
  },
  {
    id: "restaurant",
    name: "Restaurant",
    desc: "Hero, menu highlights, booking CTA.",
    prompt:
      "Design a modern restaurant one-pager with hero, menu highlights (starters/mains/desserts), a gallery strip, opening hours, and a booking CTA. Plain HTML/CSS.",
    blocks: ["hero", "features", "cta", "faq"],
  },
  {
    id: "hello-world",
    name: "Hello World",
    desc: "Ultra-minimal starter page.",
    prompt:
      "Generate an ultra-minimal single-file landing with a headline, a short paragraph and one CTA button. Plain HTML + styles.css.",
    blocks: ["hero", "cta"],
  },
];
