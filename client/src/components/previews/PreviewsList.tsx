import { useEffect, useState } from "react";
import { exportZip, deployNetlify, deployVercel } from "@/lib/previewsActions";
import { useToast } from "@/hooks/use-toast";

type StoredPreview = {
  id: string;
  name: string;
  previewPath: string;
  createdAt: number;
};

const STORE_KEY = "ybuilt.previews";

function load(): StoredPreview[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch { return []; }
}

export default function PreviewsList() {
  const { toast } = useToast();
  const [items, setItems] = useState<StoredPreview[]>(load());

  useEffect(() => {
    // if another tab adds a preview
    const onStorage = () => setItems(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No previews yet. Fork a template first.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center justify-between border rounded p-3">
          <div className="min-w-0">
            <div className="font-medium truncate">{it.name}</div>
            <a className="text-xs text-blue-600 underline" href={it.previewPath} target="_blank" rel="noreferrer">
              {it.previewPath}
            </a>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              className="text-xs px-2 py-1 border rounded"
              onClick={() => exportZip(it.previewPath).catch(e => {
                toast({ title: "Export", description: String(e?.message || e), variant: "destructive" })
              })}
            >
              Export ZIP
            </button>

            <button
              className="text-xs px-2 py-1 border rounded"
              onClick={async () => {
                try {
                  const r = await deployNetlify(it.previewPath, `ybuilt-${slugify(it.name)}`);
                  toast({ title: "Netlify", description: r.url || r.admin_url || "Deployed" });
                } catch (e:any) {
                  toast({ title: "Netlify", description: e?.message || "Deploy failed", variant:"destructive" });
                }
              }}
            >
              Deploy → Netlify
            </button>

            <button
              className="text-xs px-2 py-1 border rounded"
              onClick={async () => {
                try {
                  const r = await deployVercel(it.previewPath, `ybuilt-${slugify(it.name)}`);
                  toast({ title: "Vercel", description: r.url || "Deployment started" });
                } catch (e:any) {
                  toast({ title: "Vercel", description: e?.message || "Deploy failed", variant:"destructive" });
                }
              }}
            >
              Deploy → Vercel
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
