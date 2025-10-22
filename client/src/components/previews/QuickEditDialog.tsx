import { useEffect, useState } from "react";

export default function QuickEditDialog({
  open,
  onClose,
  previewPath,
  file = "index.html",
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  previewPath: string;
  file?: string;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const q = new URLSearchParams({ path: previewPath, file }).toString();
        const r = await fetch(`/api/previews/read?${q}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "read failed");
        setValue(data.content || "");
      } catch (e: any) {
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, previewPath, file]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-16 -translate-x-1/2 w-[min(900px,92vw)] rounded-2xl border bg-white dark:bg-zinc-900 shadow-2xl">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-medium text-sm">Quick edit • {file}</div>
          <button className="text-xs px-2 py-1 border rounded" onClick={onClose}>Close</button>
        </div>

        <div className="p-3">
          {loading ? (
            <div className="text-sm text-zinc-500">Loading…</div>
          ) : err ? (
            <div className="text-sm text-red-600">{err}</div>
          ) : (
            <textarea
              className="w-full h-[60vh] text-sm font-mono p-3 rounded border bg-white/50 dark:bg-zinc-900/50"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </div>

        <div className="p-3 border-t flex items-center justify-end gap-2">
          <button className="text-xs px-3 py-1.5 border rounded" onClick={onClose}>Cancel</button>
          <button
            className="text-xs px-3 py-1.5 border rounded"
            disabled={saving || loading}
            onClick={async () => {
              setSaving(true);
              setErr(null);
              try {
                const r = await fetch("/api/previews/write", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ path: previewPath, file, content: value }),
                });
                const data = await r.json();
                if (!r.ok || !data?.ok) throw new Error(data?.error || "save failed");
                onSaved?.();
                // open or refresh the preview with a cache buster
                const bust = previewPath.endsWith("/") ? previewPath : previewPath + "/";
                window.open(`${bust}?t=${Date.now()}`, "_blank", "noopener,noreferrer");
                onClose();
              } catch (e: any) {
                setErr(e?.message || "Failed to save");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save & Open"}
          </button>
        </div>
      </div>
    </div>
  );
}
