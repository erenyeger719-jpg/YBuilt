// server/sections/packs.ts
export type SectionPack = { slug: string; title: string; description: string; sections: string[]; tags?: string[] };

export const SECTION_PACKS: SectionPack[] = [
  {
    slug: "starter-waitlist",
    title: "Starter – Waitlist",
    description: "Lean signup flow with proof-friendly copy slots.",
    sections: ["hero-basic", "features-3col", "cta-simple"],
    tags: ["minimal","fast"]
  },
  {
    slug: "saas-lite",
    title: "SaaS – Lite",
    description: "Docs-first tone, light pricing, focus on reliability.",
    sections: ["hero-basic", "features-3col", "pricing-simple", "cta-simple"],
    tags: ["saas","serious"]
  },
  {
    slug: "portfolio-glow",
    title: "Portfolio – Glow",
    description: "Visual-forward setup with features and FAQ.",
    sections: ["hero-basic", "features-3col", "faq-accordion", "cta-simple"],
    tags: ["portfolio","playful"]
  },
  {
    slug: "commerce-drop",
    title: "Commerce – Drop",
    description: "Product announce with feature highlights.",
    sections: ["hero-basic", "features-3col", "cta-simple"],
    tags: ["ecommerce"]
  },
  {
    slug: "pricing-focus",
    title: "Pricing – Focus",
    description: "Go-to pricing + clear CTA.",
    sections: ["hero-basic", "pricing-simple", "cta-simple"],
    tags: ["serious","minimal"]
  }
];

export function listPacks() { return SECTION_PACKS; }
export function findPack(slug: string) { return SECTION_PACKS.find(p => p.slug === slug) || null; }
