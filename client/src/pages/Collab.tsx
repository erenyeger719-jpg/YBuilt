import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { usePresence, onCursor, emitCursor, onMention } from "@/lib/collab";
import CommentsDialog from "@/components/collab/CommentsDialog";
import AiQnaDialog from "@/components/collab/AiQnaDialog";

/* -------------------- base64url helpers (binary-safe) -------------------- */
function b64uEncode(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64uDecode(s: string) {
  const pad = (t: string) => t + "===".slice((t.length + 3) % 4);
  const b64 = pad(s).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Allow other pages to deep-link into a collab room from a preview path */
export function collabUrlForPreview(previewPath: string) {
  return `/collab/${b64uEncode(previewPath)}`;
}

export default function CollabPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, setLoc] = useLocation();
  const { toast } = useToast();

  // decode the previewPath from param
  const previewPath = (() => {
    try {
      return b64uDecode(roomId);
    } catch {
      return "";
    }
  })();

  // guard: if bad param, bounce to library
  useEffect(() => {
    if (!previewPath.startsWith("/previews/")) {
      toast({
        title: "Invalid room",
        description: "Bad link or missing preview.",
        variant: "destructive",
      });
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

  // textarea ref (jump-to selection)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // presence
  const me = {
    name: localStorage.getItem("ybuilt.name") || "You",
    color: localStorage.getItem("ybuilt.color") || "#8b5cf6",
    file: sel,
  };
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
        setFiles([]);
        setSel("index.html");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [previewPath, toast]);

  // load file content
  useEffect(() => {
    if (!sel) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/previews/read?path=${encodeURIComponent(previewPath)}&file=${encodeURIComponent(sel)}`
        );
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
    return () => {
      alive = false;
    };
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

  /* ------------ cursors/mentions (same logic you used in QuickEditDialog) ------------ */

  // remote cursor state keyed by peerId
  const [cursors, setCursors] = useState<
    Record<string, { file?: string; startLine?: number; endLine?: number; ts: number }>
  >({});

  // compute line range for current selection
  function computeLineRange(
    selr: { from: number; to: number } | null,
    body: string
  ): { startLine?: number; endLine?: number } {
    if (!selr) return {};
    const len = body?.length ?? 0;
    const from = Math.max(0, Math.min(selr.from ?? 0, len));
    const to = Math.max(from, Math.min(selr.to ?? from, len));
    const pre = body.slice(0, from);
    const within = body.slice(from, to);
    const startLine = pre.split("\n").length;
    const lineCount = within ? within.split("\n").length : 1;
    const endLine = startLine + lineCount - 1;
    return { startLine, endLine };
  }

  // debounce emit cursor updates to the room
  const emitTimer = useRef<number | null>(null);
  useEffect(() => {
    const range = computeLineRange(selRange, text);
    if (emitTimer.current) window.clearTimeout(emitTimer.current);
    emitTimer.current = window.setTimeout(() => {
      emitCursor({ file: sel, ...range });
    }, 120);
    return () => {
      if (emitTimer.current) window.clearTimeout(emitTimer.current);
    };
  }, [selRange?.from, selRange?.to, sel, text]);

  // listen for remote cursor updates
  useEffect(() => {
    const off = onCursor((p: any) => {
      if (!p?.peerId) return;
      setCursors((prev) => ({ ...prev, [p.peerId]: p }));
    });
    return off;
  }, []);

  // mention pings -> toast when it's for me
  useEffect(() => {
    const myName = (localStorage.getItem("ybuilt.name") || "You").trim().toLowerCase();
    const off = onMention((p: any) => {
      if (!p?.toName) return;
      if (String(p.toName).trim().toLowerCase() === myName) {
        toast({
          title: `Mentioned by ${p.from?.name || "someone"}`,
          description: `${p.file || ""}${p.commentId ? ` • comment ${String(p.commentId).slice(0, 8)}` : ""}`,
        });
      }
    });
    return off;
  }, [toast]);

  // Hotkey: Cmd/Ctrl+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) doSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving]);

  // --- Jump helpers (from comment -> editor selection) ---
  function offsetsForLines(body: string, startLine?: number, endLine?: number) {
    if (!body) return { start: 0, end: 0 };
    const lines = body.split("\n");
    const sL = Math.max(1, Math.min(startLine || 1, lines.length));
    const eL = Math.max(sL, Math.min(endLine || sL, lines.length));

    let start = 0;
    for (let i = 0; i < sL - 1; i++) start += lines[i].length + 1; // +1 newline

    let end = start;
    for (let i = sL - 1; i < eL; i++) end += lines[i].length + (i < eL - 1 ? 1 : 0);

    return { start, end };
  }

  function handleJump(p: { file: string; startLine?: number; endLine?: number }) {
    const targetFile = p.file || "index.html";
    if (targetFile === sel) {
      const { start, end } = offsetsForLines(text, p.startLine, p.endLine);
      requestAnimationFrame(() => {
        const ta = textAreaRef.current;
        if (!ta) return;
        ta.focus();
        ta.selectionStart = start;
        ta.selectionEnd = end;
        const line = p.startLine || 1;
        const approxLineHeight = 18; // px
        ta.scrollTop = Math.max(0, (line - 3) * approxLineHeight);
      });
      return;
    }
    setSel(targetFile);
    setTimeout(() => {
      const ta = textAreaRef.current;
      if (!ta) return;
      const { start, end } = offsetsForLines(ta.value || "", p.startLine, p.endLine);
      ta.focus();
      ta.selectionStart = start;
      ta.selectionEnd = end;
      const line = p.startLine || 1;
      const approxLineHeight = 18;
      ta.scrollTop = Math.max(0, (line - 3) * approxLineHeight);
    }, 350);
  }

  // page chrome
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6 pt-24">
        <div className="mb-4 flex items-center gap-2">
          <div className="font-medium">Collab Room</div>
          <div className="text-xs text-muted-foreground">{previewPath}</div>
          <div className="ml-auto flex items-center gap-2">
            {/* presence chips (with live selection ranges when on the same file) */}
            {(peers || []).map((p: any) => {
              const cur = cursors[p.id];
              const lineBadge =
                cur && cur.file === sel && typeof cur.startLine === "number"
                  ? ` • L${cur.startLine}${cur.endLine && cur.endLine !== cur.startLine ? `–${cur.endLine}` : ""}`
                  : p.file
                  ? ` • ${p.file}`
                  : "";
              return (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                  style={{ background: `${p.color ?? "#8b5cf6"}22`, border: `1px solid ${(p.color ?? "#8b5cf6")}66` }}
                  title={p.file ? `${p.name} • ${p.file}` : p.name}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color ?? "#8b5cf6" }} />
                  {p.name}
                  {lineBadge}
                </span>
              );
            })}
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  toast({ title: "Link copied" });
                } catch {
                  /* noop */
                }
              }}
            >
              Share
            </Button>
          </div>
        </div>

        {/* toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <select
            className="text-xs border rounded px-2 py-1 bg-transparent"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
          >
            {files.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <button
            className="text-xs px-2 py-1 border rounded"
            onClick={() => {
              const name = prompt("New file (index2.html / styles2.css / app2.js):", "snippet.js")?.trim();
              if (!name) return;
              const ok = /^[a-zA-Z0-9._/-]+$/.test(name) && /\.(html?|css|js)$/i.test(name);
              if (!ok) return alert("Only .html, .htm, .css, .js with safe name.");
              setFiles((f) => (f.includes(name) ? f : [...f, name].sort()));
              setSel(name);
              setText(name.toLowerCase().endsWith(".html") ? "<!-- new file -->\n" : "/* new file */\n");
            }}
          >
            New file…
          </button>

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
                if (!r.ok || !data?.ok) throw new Error(data?.error || "Delete failed");
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

          <button
            className="text-xs px-2 py-1 border rounded ml-auto"
            disabled={!canSave}
            onClick={doSave}
          >
            {saving ? "Saving…" : /\.html?$/i.test(sel) ? "Save" : "Save"}
          </button>

          <button className="text-xs px-2 py-1 border rounded" onClick={() => setCommentsOpen(true)}>
            Comments
          </button>
          <button className="text-xs px-2 py-1 border rounded" onClick={() => setQnaOpen(true)}>
            Ask AI
          </button>
        </div>

        {/* editor */}
        <div className="border rounded bg-background">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <textarea
              ref={textAreaRef}
              className="w-full h-[70vh] text-sm font-mono p-3 bg-transparent outline-none"
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
        onJump={handleJump}
      />
      <AiQnaDialog open={qnaOpen} onClose={() => setQnaOpen(false)} previewPath={previewPath} file={sel} />
    </div>
  );
}
