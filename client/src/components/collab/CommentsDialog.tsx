import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { onCommentEvent, broadcastComment, sendMention } from "@/lib/collab";

type CommentItem = {
  id: string; file: string; startLine?: number; endLine?: number;
  text: string; author: { name: string }; createdAt: number; resolved?: boolean;
};

export default function CommentsDialog({
  open, onClose, previewPath, file, selection, totalText,
}: {
  open: boolean;
  onClose: () => void;
  previewPath: string;
  file: string;
  selection?: { from: number; to: number };
  totalText: string;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const r = await fetch(`/api/comments/list?path=${encodeURIComponent(previewPath)}`);
      const data = await r.json();
      setItems(data?.items || []);
    })();
    const off = onCommentEvent((p) => {
      if (p?.type === "added" && p?.previewPath === previewPath) {
        setItems((prev) => [p.item, ...prev]);
      }
      if (p?.type === "resolved" && p?.previewPath === previewPath) {
        setItems((prev) => prev.map(x => x.id === p.id ? { ...x, resolved: p.resolved } : x));
      }
    });
    return off;
  }, [open, previewPath]);

  function selLines() {
    if (!selection || !totalText) return {};
    const body = String(totalText);
    const from = Math.max(0, Math.min(selection.from ?? 0, body.length));
    const to = Math.max(from, Math.min(selection.to ?? from, body.length));
    const pre = body.slice(0, from);
    const within = body.slice(from, to);
    const startLine = pre.split("\n").length;
    const lineCount = within ? within.split("\n").length : 1;
    const endLine = startLine + lineCount - 1;
    return { startLine, endLine };
  }

  async function addComment() {
    if (!text.trim()) return;
    const range = selLines();
    const body = text; // capture before clearing for mention parsing
    try {
      const r = await fetch("/api/comments/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: previewPath, file, text: body, ...range, author: { name: "You" } }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "add failed");
      setItems((prev) => [data.item, ...prev]);
      broadcastComment({ type: "added", previewPath, item: data.item });

      // --- Mentions (@Name) ---
      const meName = localStorage.getItem("ybuilt.name") || "You";
      const atNames = Array.from(
        new Set(
          (body.match(/@\w[\w.-]*/g) || [])
            .map((s) => s.slice(1))
            .filter(Boolean)
        )
      );
      for (const toName of atNames) {
        sendMention({
          toName,
          from: { name: meName, color: localStorage.getItem("ybuilt.color") || "#8b5cf6" },
          previewPath,
          file,
          commentId: data.item?.id || "",
        });
      }

      setText("");
    } catch (e: any) {
      toast({ title: "Add failed", description: e?.message || "Error", variant: "destructive" });
    }
  }

  async function toggleResolve(it: CommentItem) {
    try {
      const r = await fetch("/api/comments/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: previewPath, id: it.id, resolved: !it.resolved }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "resolve failed");
      setItems((prev) => prev.map(x => x.id === it.id ? data.item : x));
      broadcastComment({ type: "resolved", previewPath, id: it.id, resolved: !it.resolved });
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || "Error", variant: "destructive" });
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[1200] grid place-items-center p-4">
      <div className="w-full max-w-xl rounded-lg bg-black/80 text-white border border-white/20 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Comments — {file}</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="mb-3">
          <textarea
            className="w-full h-20 text-sm bg-black/30 border border-white/20 rounded p-2"
            placeholder="Add a comment… (anchors to your current selection)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="secondary" onClick={addComment}>Add</Button>
          </div>
        </div>

        <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
          {items.map((it) => (
            <li key={it.id} className="rounded border border-white/20 p-3 bg-black/60">
              <div className="text-xs text-white/60 mb-1">
                {it.file}{typeof it.startLine === "number" ? ` • L${it.startLine}${it.endLine && it.endLine !== it.startLine ? `–${it.endLine}` : ""}` : ""}
              </div>
              <div className="text-sm">{it.text}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-white/50">{new Date(it.createdAt).toLocaleString()}</div>
                <Button size="sm" variant="ghost" onClick={() => toggleResolve(it)}>
                  {it.resolved ? "Reopen" : "Resolve"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
