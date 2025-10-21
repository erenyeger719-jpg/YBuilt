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
    id: "hello-world",
    name: "Hello World",
    description: "Ultra-minimal starter—one page wired with Vite + Tailwind.",
    tags: ["starter", "vite", "minimal"],
    previewPath: "/previews/hello-world/",
  },
  {
    id: "blank-starter",
    name: "Blank Starter",
    description: "Empty shell with sensible defaults and a clean folder structure.",
    tags: ["starter", "blank", "scaffold"],
    previewPath: "/previews/blank-starter/",
  },
];
