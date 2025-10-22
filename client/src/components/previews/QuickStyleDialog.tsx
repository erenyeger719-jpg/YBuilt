import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onClose: () => void;
  previewPath: string; // "/previews/forks/slug/"
  file: string;        // "styles.css" (or whatever ensureAsset returned)
};

export default function QuickStyleDialog({ open, onClose, previewPath, file }: Props) {
  const { toast } = useToast();

  const [busy, setBusy] = useState(false);
  const [rawCss, setRawCss] = useState<string>("");

  // tokens
  const [primary, setPrimary] = useState("#4f46e5");
  const [bg, setBg] = useState("#ffffff");
  const [radius, setRadius] = useState(12);
  const [baseFont, setBaseFont] = useState(16);

  // Read existing CSS to prefill if token block exists
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/previews/read?path=${encodeURIComponent(previewPath)}&file=${encodeURIComponent(file)}`
        );
        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.error || "read failed");
        const css = String(data.content ?? "");
        setRawCss(css);

        const block = css.match(/\/\* YBUILT:STYLE_TOKENS_START \*\/([\s\S]*?)\/\* YBUILT:STYLE_TOKENS_END \*\//);
        if (block) {
          const sub = block[1];
          const get = (name: string, def: string) =>
            (sub.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1] || def).trim();
          const p = get("--primary", primary);
          const b = get("--bg", bg);
          const r = get("--radius", `${radius}px`).replace("px", "");
          const f = get("--base-font", `${baseFont}px`).replace("px", "");
          if (/^#|rgb|hsl/i.test(p)) setPrimary(p);
          if (/^#|rgb|hsl/i.test(b)) setBg(b);
          const rNum = parseInt(r, 10); if (!Number.isNaN(rNum)) setRadius(rNum);
          const fNum = parseInt(f, 10); if (!Number.isNaN(fNum)) setBaseFont(fNum);
        }
      } catch {
        setRawCss("");
      }
    })();
  }, [open, previewPath, file]);

  const blockCss = useMemo(() => {
    return `/* YBUILT:STYLE_TOKENS_START */
:root{
  --primary: ${primary};
  --bg: ${bg};
  --radius: ${radius}px;
  --base-font: ${baseFont}px;
}
/* Opinionated helpers so you see the change quickly */
body { background: var(--bg); font-size: var(--base-font); }
a { color: var(--primary); }
.btn, button { border-radius: var(--radius); }
.btn-primary { background: var(--primary); color: white; }
/* YBUILT:STYLE_TOKENS_END */`;
  }, [primary, bg, radius, baseFont]);

  function upsertTokenBlock(existing: string, block: string) {
    const re = /\/\* YBUILT:STYLE_TOKENS_START \*\/[\s\S]*?\/\* YBUILT:STYLE_TOKENS_END \*\//;
    if (re.test(existing)) return existing.replace(re, block);
    return `${block}\n\n${existing}`; // prepend for visibility
  }

  async function writeFile(path: string, fname: string, content: string) {
    const r = await fetch("/api/previews/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, file: fname, content }),
    });
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.error || "write failed");
  }

  async function applyAndOpen() {
    if (busy) return;
    setBusy(true);
    try {
      const nextCss = upsertTokenBlock(rawCss, blockCss);
      await writeFile(previewPath, file, nextCss);

      // open the page so changes are visible
      const target = `${previewPath}index.html`.replace(/\/+$/, "");
      const url = `${target}?t=${Date.now()}`;
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) window.location.href = url;

      toast({ title: "Styles updated", description: file });
      onClose();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-16 -translate-x-1/2 w-[min(720px,95vw)] rounded-2xl border bg-white dark:bg-zinc-900 shadow-2xl">
        <div className="flex items-center gap-2 p-3 border-b">
          <div className="font-medium">Style Tweaks</div>
          <div className="ml-auto text-xs text-zinc-500">{file}</div>
          <button className="text-xs px-2 py-1 border rounded" onClick={onClose}>Close</button>
          <button
            className="text-xs px-2 py-1 border rounded"
            onClick={applyAndOpen}
            disabled={busy}
          >
            {busy ? "Saving…" : "Apply & open"}
          </button>
        </div>

        <div className="p-4 grid grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span className="block">Primary color</span>
            <input type="color" className="w-12 h-8 p-0 border rounded"
              value={primary} onChange={(e) => setPrimary(e.target.value)} />
          </label>

          <label className="text-sm space-y-1">
            <span className="block">Background</span>
            <input type="color" className="w-12 h-8 p-0 border rounded"
              value={bg} onChange={(e) => setBg(e.target.value)} />
          </label>

          <label className="text-sm space-y-1">
            <span className="block">Corner radius (px)</span>
            <input type="number" className="w-24 border rounded px-2 py-1"
              value={radius} min={0} max={48} onChange={(e) => setRadius(parseInt(e.target.value || "0", 10))} />
          </label>

          <label className="text-sm space-y-1">
            <span className="block">Base font size (px)</span>
            <input type="number" className="w-24 border rounded px-2 py-1"
              value={baseFont} min={10} max={24} onChange={(e) => setBaseFont(parseInt(e.target.value || "16", 10))} />
          </label>

          <div className="col-span-2">
            <div className="text-xs text-zinc-500 mb-2">
              This writes a token block into <code>{file}</code> between markers. Safe to edit later.
            </div>
            <pre className="text-[11px] border rounded p-3 overflow-auto bg-zinc-50 dark:bg-zinc-800">
{blockCss}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
