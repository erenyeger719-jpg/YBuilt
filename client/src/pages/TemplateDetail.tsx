import { useRoute } from "wouter";

type T = {
  id: string;
  name: string;
  blurb: string;
  tags: string[];
  demo: string;        // e.g. /previews/demo-landing/
  sourceId: string;    // id used by /api/previews/fork
};

// minimal catalog (expand later)
const CATALOG: Record<string, T> = {
  "hello-world": {
    id: "hello-world",
    name: "Hello World",
    blurb: "Ultra-minimal starter — Vite + Tailwind, one page.",
    tags: ["starter", "vite", "minimal"],
    demo: "/previews/hello-world/",
    sourceId: "hello-world",
  },
  "demo-landing": {
    id: "demo-landing",
    name: "Polished Landing Page",
    blurb: "Clean hero, features, CTA. Great for SaaS/portfolio starts.",
    tags: ["landing", "tailwind", "marketing"],
    demo: "/previews/demo-landing/",
    sourceId: "demo-landing",
  },
  "blank-starter": {
    id: "blank-starter",
    name: "Blank Starter",
    blurb: "Empty shell with sensible defaults and clean folders.",
    tags: ["starter", "blank", "scaffold"],
    demo: "/previews/blank-starter/",
    sourceId: "blank-starter",
  },
};

async function fork(sourceId: string, name: string) {
  const r = await fetch("/api/previews/fork", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId }),
  });
  const data = await r.json();
  if (!r.ok || !data?.path) throw new Error(data?.error || "fork failed");

  const STORE_KEY = "ybuilt.previews";
  const existing = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  const item = { id: `fork-${Date.now()}`, name, previewPath: data.path, createdAt: Date.now() };
  localStorage.setItem(STORE_KEY, JSON.stringify([item, ...existing]));

  const win = window.open(data.path, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = data.path;
}

export default function TemplateDetail() {
  const [match, params] = useRoute("/templates/:id");
  const tpl = match ? CATALOG[params!.id] : undefined;

  if (!tpl) {
    return (
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">Template not found</h1>
        <a className="underline" href="/templates">Back to templates</a>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{tpl.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">{tpl.blurb}</p>
        <div className="mt-2 flex gap-2 flex-wrap">
          {tpl.tags.map((t) => (
            <span key={t} className="text-[11px] px-2 py-0.5 rounded border">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <a className="text-sm px-3 py-1.5 border rounded" href={tpl.demo} target="_blank" rel="noreferrer">
          Live demo
        </a>
        <button
          className="text-sm px-3 py-1.5 border rounded"
          onClick={() => fork(tpl.sourceId, tpl.name)}
        >
          Fork this template
        </button>
        <a className="text-sm px-3 py-1.5 border rounded" href="/templates">All templates</a>
      </div>
    </div>
  );
}
