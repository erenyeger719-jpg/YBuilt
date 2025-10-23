// client/src/pages/Templates.tsx
import { useState } from "react";
import { TEMPLATES, type TemplateDef } from "@/lib/templates";
import { aiScaffold } from "@/lib/aiActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const STORE_KEY = "ybuilt.previews";
const TIER_KEY = "ybuilt.aiTier";

const setSorted = (items: any[]) => [...items].sort((a, b) => b.createdAt - a.createdAt);
const openOrNavigate = (url: string) => {
 // same-tab = not a popup, so it won't be blocked
  window.location.assign(url);
};

export default function TemplatesPage() {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const aiTier = (localStorage.getItem(TIER_KEY) as any) || "balanced";

  async function useTemplate(tpl: TemplateDef, picked: Record<string, boolean>) {
    try {
      setBusyId(tpl.id);
      const blocks = Object.keys(picked).filter((k) => picked[k]);

      const { path } = await aiScaffold({
        prompt: tpl.prompt,
        tier: aiTier,
        blocks,
      } as any);

      const item = {
        id: `ai-${Date.now()}`,
        name: tpl.name.slice(0, 40),
        previewPath: path,
        createdAt: Date.now(),
        deploys: [],
      };

      const prev = (() => {
        try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
        catch { return []; }
      })();

      const next = setSorted([item, ...prev]);
      localStorage.setItem(STORE_KEY, JSON.stringify(next));

      toast({ title: "Template generated", description: tpl.name });
      // tell the Library to auto-open this preview in the editor
      localStorage.setItem(
        "ybuilt.quickedit.autoOpen",
        JSON.stringify({ path, file: "index.html" })
      );
      // same-tab navigation avoids popup blockers
      window.location.assign("/library?open=1");
    } catch (e: any) {
      toast({ title: "Generate failed", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Templates</h1>
        <a href="/library">
          <Button variant="secondary" size="sm">Back to Library</Button>
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            tpl={tpl}
            busy={busyId === tpl.id}
            onUse={useTemplate}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  tpl,
  busy,
  onUse,
}: {
  tpl: TemplateDef;
  busy?: boolean;
  onUse: (tpl: TemplateDef, picked: Record<string, boolean>) => void;
}) {
  const defaultPicked = Object.fromEntries((tpl.blocks || []).map((b) => [b, true]));
  const [picked, setPicked] = useState<Record<string, boolean>>(defaultPicked);

  function toggle(b: string) {
    setPicked((p) => ({ ...p, [b]: !p[b] }));
  }

  return (
    <div className="bg-black/60 border border-white/15 rounded-xl p-4 text-white space-y-3">
      <div className="aspect-video w-full rounded-lg bg-white/5 grid place-items-center text-white/40 text-xs">
        {/* thumbnail later */}
        preview
      </div>
      <div className="font-medium">{tpl.name}</div>
      <div className="text-sm text-white/70">{tpl.desc}</div>

      {!!(tpl.blocks?.length) && (
        <>
          <div className="text-[11px] uppercase tracking-wide text-white/50 mt-2">Sections</div>
          <div className="flex flex-wrap gap-2">
            {tpl.blocks!.map((b) => (
              <label key={b} className="text-xs flex items-center gap-1 bg-black/40 border border-white/15 rounded-full px-2 py-1">
                <input
                  type="checkbox"
                  checked={!!picked[b]}
                  onChange={() => toggle(b)}
                />
                <span className="capitalize">{b}</span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => onUse(tpl, picked)}
        >
          {busy ? "Generating…" : "Use"}
        </Button>
        <a href="/library" className="text-xs text-blue-300 underline">Manage later</a>
      </div>
    </div>
  );
}
