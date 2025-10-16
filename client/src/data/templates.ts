export type Template = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  previewPath: string; // e.g. "/previews/demo-landing/"
  repo?: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "demo-landing",
    name: "Polished Landing Page",
    description: "Clean hero, features, CTA. Great for SaaS/portfolio starts.",
    tags: ["landing", "tailwind", "marketing"],
    previewPath: "/previews/demo-landing/",
  },
  {
    id: "saas-dashboard",
    name: "SaaS Dashboard (coming soon)",
    description: "Auth, billing stubs, analytics widgets.",
    tags: ["saas", "react", "charts"],
    previewPath: "/previews/saas-dashboard/", // placeholder
  },
  {
    id: "blog-starter",
    name: "MDX Blog (coming soon)",
    description: "Blog with MDX posts and tags.",
    tags: ["blog", "mdx"],
    previewPath: "/previews/blog-starter/", // placeholder
  },
];
