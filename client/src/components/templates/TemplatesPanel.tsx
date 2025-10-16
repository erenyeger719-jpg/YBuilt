import { useEffect, useMemo, useState } from "react";
import TemplateCard from "./TemplateCard";
import { TEMPLATES, type Template } from "../../data/templates";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";

const STORE_KEY = "ybuilt.previews";

type StoredPreview = {
  id: string;
  name: string;
  previewPath: string;
  createdAt: number;
};

export default function TemplatesPanel() {
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEMPLATES;
    return TEMPLATES.filter((t) =>
      [t.name, t.description, ...t.tags].join(" ").toLowerCase().includes(q)
    );
  }, [query]);

  function handleFork(t: Template) {
    const item: StoredPreview = {
      id: t.id,
      name: t.name,
      previewPath: t.previewPath,
      createdAt: Date.now(),
    };
    const existing: StoredPreview[] = JSON.parse(
      localStorage.getItem(STORE_KEY) || "[]"
    );
    localStorage.setItem(STORE_KEY, JSON.stringify([item, ...existing]));

    toast({
      title: "Project forked",
      description: `Created from “${t.name}”. Find it under Previews.`,
    });
  }

  // focus search on mount
  useEffect(() => {
    const el = document.getElementById("template-search") as HTMLInputElement | null;
    el?.focus();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pick a starter. Preview live. Fork to begin.
          </p>
        </div>
        <a className="text-sm underline" href="/previews">Previews →</a>
      </div>

      <div>
        <Input
          id="template-search"
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <TemplateCard key={t.id} template={t} onFork={handleFork} />
        ))}
      </div>
    </div>
  );
}
