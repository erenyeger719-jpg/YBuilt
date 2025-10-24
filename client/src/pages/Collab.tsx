// client/src/pages/Collab.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { usePresence, onCursor, emitCursor, onMention } from "@/lib/collab";
import CommentsDialog from "@/components/collab/CommentsDialog";
import AiQnaDialog from "@/components/collab/AiQnaDialog";

// --- helpers: base64url <-> string ---
function b64uEncode(s: string) {
  // ok for browser strings
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64uDecode(s: string) {
  const pad = (t: string) => t + "===".slice((t.length + 3) % 4);
  const b64 = pad(s).replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(b64)));
}

export default function CollabPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, setLoc] = useLocation();
  const { toast } = useToast();

  // decode the previewPath from param
  const previewPath = (() => {
    try { return b64uDecode(roomId); } catch { return ""; }
  })();

  // guard: if bad param, bounce to library
  useEffect(() => {
    if (!previewPath.startsWith("/previews/")) {
      toast({ title: "Invalid room", description: "Bad link or missing preview.", variant: "destructive" });
      setLoc("/library");
    }
  }, [previewPath, setLoc, toast]);

  // files + editor
  const [files, setFiles] = useState<string[]>([]);
  const [sel, setSel] = useState("index.html");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // collab modals
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [qnaOpen, setQnaOpen] = useState(false);
  const [selRange, setSelRange] = useState<{ from: number; to: number } | null>(null);

  // presence
  const me = {
    name: localStorage.getItem("ybuilt.name") || "You",
    color: localStorage.getItem("ybuilt.color") || "#8b5cf6",
    file: sel,
  };
  // Room = previewPath (server already handles string rooms)
  const { peers } = usePresence(previewPath, { ...me, file: sel });

  // load list
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/previews/list?path=${encodeURIComponent(previewPath)}`);
        const d = await r.json();
        const list: string[] = Array.isArray(d?.files) ? d.files : [];
        if (!alive) return;
        setFiles(list);
        const preferred = list.includes("index.html") ? "index.html" : list[0] || "index.html";
        setSel(preferred);
      } catch (e: any) {
        toast({ title: "List failed", description: e?.message || "Error", variant: "destructive" });
        setFiles([]); setSel("index.html");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [previewPath, toast]);

  // load file content
  useEffect(() => {
    if (!sel) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/previews/read?path=${encodeURIComponent(previewPath)}&file=${encodeURIComponent(sel)}`);
        const d = await r.json();
        if (!r.ok || !d?.ok) throw new Error(d?.error || "read failed");
        if (alive) setText(String(d.content ?? ""));
      } catch (e: any) {
        if (alive) setText("");
        toast({ title: "Read failed", description: e?.message || "Error", variant: "destructive" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [previewPath, sel, toast]);

  const canSave = useMemo(() => !saving && !!sel, [saving, sel]);

  async function doSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const r = await fetch("/api/previews/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: previewPath, file: sel, content: text }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error || "write failed");
      toast({ title: "Saved", description: sel });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // --- live cursors + mentions ---
  // compute line range for selection
  function computeLineRange(selr: { from: number; to: number } | null, body: string) {
    if (!selr) return {};
    const len = body.length;
    const from = Math.max(0, Math.min(selr.from ?? 0, len));
    const to = Math.max(from, Math.min(selr.to ?? from, len));
    const pre = body.slice(0, from);
    const within = body.slice(from, to);
    const startLine = pre.split("\n").length;
    const endLine = startLine + (within ? within.split("\n").length : 1) - 1;
    return { startLine, endLine };
  }

  // throttle emits
  const emitTimer = useRef<number | null>(null);
  useEffect(() => {
    const range = computeLineRange(selRange, text);
    if (emitTimer.current) window.clearTimeout(emitTimer.current);
    emitTimer.current = window.setTimeout(() => {
      emitCursor({ file: sel, ...range });
    }, 120);
    return () => { if (emitTimer.current) window.clearTimeout(emitTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selRange?.from, selRange?.to, sel, text]);

  const [cursors, setCursors] = useState<Record<string, { file?: string; startLine?: number; endLine?: number; ts: number }>>({});
  useEffect(() => {
    const off = onCursor((p) => setCursors((prev) => ({ ...prev, [p.peerId]: p })));
    return off;
  }, []);

  useEffect(() => {
    const my = (localStorage.getItem("ybuilt.name") || "You").trim().toLowerCase();
    const off = onMention((p: any) => {
      if (String(p?.toName || "").trim().toLowerCase() === my) {
        const where = p.file ? ` • ${p.file}` : "";
        toast({ title: `Mentioned by ${p.from?.name || "someone"}`, description: `${p.commentId || ""}${where}` });
      }
    });
    return off;
  }, [toast]);

  // hotkey save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); doSave(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // UI
  return (
    <div className="min-h-screen">
      <div className="relative z-10">
        <Header />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-white/60">Collab room</div>
            <div className="font-semibold text-white truncate">{previewPath}</div>
          </div>

          <div className="flex items-center gap-2">
            {/* presence chips */}
            {(peers || [])
              .filter((p: any) => p?.name !== me.name)
              .slice(0, 6)
              .map((p: any) => {
                const cur = cursors[p.id];
                const lineBadge =
                  cur && cur.file === sel && typeof cur.startLine === "number"
                    ? ` • L${cur.startLine}${cur.endLine && cur.endLine !== cur.startLine ? `–${cur.endLine}` : ""}`
                    : p.file ? ` • ${p.file}` : "";
                return (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                    style={{ background: `${p.color ?? "#8b5cf6"}22`, border: `1px solid ${(p.color ?? "#8b5cf6")}66` }}
                    title={p.file ? `${p.name} • ${p.file}` : p.name}
                  >
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color ?? "#8b5cf6" }} />
                    {p.name}{lineBadge}
                  </span>
                );
              })}
            <Button size="sm" variant="secondary" onClick={() => setCommentsOpen(true)}>Comments</Button>
            <Button size="sm" variant="secondary" onClick={() => setQnaOpen(true)}>Ask AI</Button>
            <Button size="sm" onClick={doSave} disabled={!canSave}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>

        {/* editor row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* left: files */}
          <div className="lg:col-span-3 p-3 rounded-lg border border-white/20 bg-black/30 backdrop-blur">
            <div className="text-xs text-white/60 mb-2">Files</div>
            <div className="space-y-1">
              {files.map((f) => (
                <button
                  key={f}
                  onClick={() => setSel(f)}
                  className={`w-full text-left px-2 py-1 rounded border ${sel === f ? "border-white/40 bg-white/10" : "border-transparent hover:border-white/20"}`}
                >
                  <span className="text-sm">{f}</span>
                </button>
              ))}
            </div>
          </div>

          {/* right: editor */}
          <div className="lg:col-span-9 p-3 rounded-lg border border-white/20 bg-black/30 backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">{sel}</div>
              <div className="text-xs text-white/60">{loading ? "Loading…" : `${text.split("\n").length} lines`}</div>
            </div>
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
          </div>
        </div>
      </div>

      {/* modals */}
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

// helper to create a collab URL from a previewPath:
export function collabUrlForPreview(previewPath: string) {
  return `/collab/${b64uEncode(previewPath)}`;
}
