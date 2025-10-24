import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePresence } from "@/lib/collab";
import CommentsDialog from "@/components/collab/CommentsDialog";
import AiQnaDialog from "@/components/collab/AiQnaDialog";

type Props = {
  open: boolean;
  onClose: () => void;
  previewPath: string; // e.g. "/previews/forks/slug/"
  file?: string; // kept for back-compat
  initialFile?: string; // new: preferred default
  onSaved?: () => void;
};

export default function QuickEditDialog({
  open,
  onClose,
  previewPath,
  file,
  initialFile,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<string[]>([]);
  const [sel, setSel] = useState<string>("index.html");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // collab: comments / qna + selection
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [qnaOpen, setQnaOpen] = useState(false);
  const [selRange, setSelRange] = useState<{ from: number; to: number } | null>(null);

  // presence
  const me = {
    name: localStorage.getItem("ybuilt.name") || "You",
    color: localStorage.getItem("ybuilt.color") || "#8b5cf6",
    file: sel,
  };
  const { peers } = usePresence(previewPath, { ...me, file: sel });
  useEffect(() => {
    // switching `sel` updates my current file in presence via the hook deps
  }, [sel, previewPath]);

  // load file list when opened / path changes
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/previews/list?path=${encodeURIComponent(previewPath)}`
        );
        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.error || "list failed");

        // Guard against non-array responses
        const files: string[] = Array.isArray(data.files) ? data.files : [];

        setFiles(files);
        // choose default
        const preferred = initialFile || file || "index.html";
        setSel(files.includes(preferred) ? preferred : files[0] || "index.html");
      } catch (e: any) {
        setFiles([]);
        setSel("index.html");
        toast({
          title: "Couldn’t list files",
          description: e?.message || "Error",
          variant: "destructive",
        });
      }
    })();
  }, [open, previewPath, initialFile, file, toast]);

  // load selected file content
  useEffect(() => {
    if (!open || !sel) return;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/previews/read?path=${encodeURIComponent(
            previewPath
          )}&file=${encodeURIComponent(sel)}`
        );
        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.error || "read failed");
        setText(data.content ?? "");
      } catch (e: any) {
        setText("");
        toast({
          title: "Read failed",
          description: e?.message || "Error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, sel, previewPath, toast]);

  const canSave = useMemo(() => !saving && !!sel, [saving, sel]);

  const doSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const r = await fetch("/api/previews/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: previewPath, file: sel, content: text }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "write failed");

      toast({ title: "Saved", description: sel });
      onSaved?.();

      // open the PAGE when saving non-HTML files
      const target = /\.html?$/i.test(sel) ? `${previewPath}${sel}` : `${previewPath}index.html`;
      const url = `${target.replace(/\/+$/, "")}?t=${Date.now()}`;
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) window.location.href = url;
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message || "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Hotkey: Cmd/Ctrl+S to save while dialog is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) {
          (async () => {
            await doSave();
          })();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-16 -translate-x-1/2 w-[min(900px,95vw)] rounded-2xl border bg-white dark:bg-zinc-900 shadow-2xl">
        <div className="flex items-center gap-2 p-3 border-b">
          <div className="font-medium">Quick edit</div>

          {/* file picker */}
          <select
            className="ml-auto text-xs border rounded px-2 py-1 bg-transparent"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
          >
            {files.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* New file… */}
          <button
            className="text-xs px-2 py-1 border rounded"
            onClick={() => {
              const name = prompt(
                "New file (index2.html / styles2.css / app2.js):",
                "snippet.js"
              )?.trim();
              if (!name) return;
              const ok =
                /^[a-zA-Z0-9._/-]+$/.test(name) && /\.(html?|css|js)$/i.test(name);
              if (!ok)
                return alert("Only .html, .htm, .css, .js with safe name.");
              setFiles((f) => (f.includes(name) ? f : [...f, name].sort()));
              setSel(name);
              setText(
                name.toLowerCase().endsWith(".html")
                  ? "<!-- new file -->\n"
                  : "/* new file */\n"
              );
            }}
          >
            New file…
          </button>

          {/* Delete file */}
          <button
            className="text-xs px-2 py-1 border rounded"
            onClick={async () => {
              if (!sel) return;
              if (!confirm(`Delete ${sel}? This cannot be undone.`)) return;
              try {
                const r = await fetch("/api/previews/remove-file", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ path: previewPath, file: sel }),
                });
                const data = await r.json();
                if (!r.ok || !data?.ok)
                  throw new Error(data?.error || "Delete failed");
                setFiles((prev) => {
                  const next = prev.filter((x) => x !== sel);
                  setSel(next[0] || "index.html");
                  setText("");
                  return next;
                });
              } catch (e: any) {
                alert(e?.message || "Delete failed");
              }
            }}
          >
            Delete file
          </button>

          {/* presence chips */}
          <div className="ml-2 flex items-center gap-1">
            {(peers || [])
              .filter((p: any) => p?.name !== me.name)
              .slice(0, 4)
              .map((p: any) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                  style={{ background: `${p.color ?? "#8b5cf6"}22`, border: `1px solid ${(p.color ?? "#8b5cf6")}66` }}
                  title={p.file ? `${p.name} • ${p.file}` : p.name}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: p.color ?? "#8b5cf6" }}
                  />
                  {p.name}{p.file ? ` • ${p.file}` : ""}
                </span>
              ))}
            {peers && peers.length > 5 && (
              <span className="text-[10px] text-white/60">+{peers.length - 5}</span>
            )}
          </div>

          {/* comments / qna */}
          <button className="text-xs px-2 py-1 border rounded" onClick={() => setCommentsOpen(true)}>
            Comments
          </button>
          <button className="text-xs px-2 py-1 border rounded" onClick={() => setQnaOpen(true)}>
            Ask AI
          </button>

          <button className="text-xs px-2 py-1 border rounded" onClick={onClose}>
            Close
          </button>
          <button
            className="text-xs px-2 py-1 border rounded"
            disabled={!canSave}
            onClick={doSave}
          >
            {saving ? "Saving…" : /\.html?$/i.test(sel) ? "Save & open" : "Save & open page"}
          </button>
        </div>

        <div className="p-3">
          {loading ? (
            <div className="text-sm text-zinc-500">Loading…</div>
          ) : (
            <textarea
              className="w-full h-[60vh] text-sm font-mono border rounded p-3 bg-transparent"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onSelect={(e) => {
                const t = e.currentTarget;
                setSelRange({ from: t.selectionStart || 0, to: t.selectionEnd || 0 });
              }}
              spellCheck={false}
            />
          )}
        </div>
      </div>

      {/* Collab modals */}
      <CommentsDialog
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        previewPath={previewPath}
        file={sel}
        selection={selRange || undefined}
        totalText={text}
      />
      <AiQnaDialog
        open={qnaOpen}
        onClose={() => setQnaOpen(false)}
        previewPath={previewPath}
        file={sel}
      />
    </div>
  );
}
