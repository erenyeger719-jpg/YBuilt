import { ExternalLink, Rocket, FolderPlus } from "lucide-react";
import { Button } from "../ui/button";
import type { Template } from "../../data/templates";

export default function TemplateCard({
  template,
  onFork,
}: {
  template: Template;
  onFork: (t: Template) => void;
}) {
  return (
    <div className="h-full rounded-2xl border bg-white/60 dark:bg-zinc-900/60 p-5 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md hover:border-zinc-300/80 dark:hover:border-zinc-700/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold leading-tight">{template.name}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {template.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="px-2.5 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button asChild className="gap-2">
          <a href={template.previewPath} target="_blank" rel="noreferrer">
            <Rocket className="h-4 w-4" /> Live demo
          </a>
        </Button>

        <Button variant="secondary" onClick={() => onFork(template)} className="gap-2">
          <FolderPlus className="h-4 w-4" /> Fork
        </Button>

        <a
          className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          href={template.previewPath}
          target="_blank"
          rel="noreferrer"
        >
          Open preview <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
