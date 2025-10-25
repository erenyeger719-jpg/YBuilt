import { useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";

type Comment = {
  id: string;
  userId?: string;
  username?: string;
  content: string;
  createdAt?: string;
  filePath: string;
  line: number | null;
  threadId: string;
  parentId: string | null;
  resolved: boolean;
};

export default function CommentsPanel({
  projectId,
  currentFile,
  onOpenFile,
}: {
  projectId: string;
  currentFile?: string;
  onOpenFile?: (filePath: string, line?: number | null) => void;
}) {
  const [items, setItems] = useState<Comment[]>([]);
  const [filterFile, setFilterFile] = useState<string>(currentFile || "");
  const [draft, setDraft] = useState("");
  const [line, setLine] = useState<number | "">("");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const s = getSocket();
    s.emit("comment:list", { projectId, filePath: filterFile || undefined });

    const onList = (p: { projectId: string; comments: Comment[] }) => {
      if (p.projectId !== projectId) return;
      setItems(p.comments);
    };
    const onCreate = (p: { projectId: string; comment: Comment }) => {
      if (p.projectId !== projectId) return;
      setItems((prev) => [...prev, p.comment]);
    };
    const onUpdate = (p: { projectId: string; id: string; content: string }) => {
      if (p.projectId !== projectId) return;
      setItems((prev) => prev.map((c) => (c.id === p.id ? { ...c, content: p.content } : c)));
    };
    const onResolve = (p: { projectId: string; threadId: string; resolved: boolean }) => {
      if (p.projectId !== projectId) return;
      setItems((prev) =>
        prev.map((c) => (c.threadId === p.threadId ? { ...c, resolved: p.resolved } : c))
      );
    };
    const onDelete = (p: { projectId: string; id: string }) => {
      if (p.projectId !== projectId) return;
      setItems((prev) => prev.filter((c) => c.id !== p.id));
    };

    s.on("comment:list", onList);
    s.on("comment:create", onCreate);
    s.on("comment:update", onUpdate);
    s.on("comment:resolve", onResolve);
    s.on("comment:delete", onDelete);

    return () => {
      s.off("comment:list", onList);
      s.off("comment:create", onCreate);
      s.off("comment:update", onUpdate);
      s.off("comment:resolve", onResolve);
      s.off("comment:delete", onDelete);
    };
  }, [projectId, filterFile]);

  const grouped = useMemo(() => {
    const byThread = new Map<string, Comment[]>();
    for (const c of items) {
      const t = byThread.get(c.threadId) || [];
      t.push(c);
      byThread.set(c.threadId, t);
    }
    for (const [k, v] of byThread) {
      v.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    }
    return Array.from(byThread.entries())
      .sort(([_, a], [__, b]) => {
        const ra = a.some((x) => !x.resolved);
        const rb = b.some((x) => !x.resolved);
        if (ra !== rb) return ra ? -1 : 1;
        const la = a[a.length - 1]?.createdAt || "";
        const lb = b[b.length - 1]?.createdAt || "";
        return lb.localeCompare(la);
      });
  }, [items]);

  function createComment(parent?: Comment) {
    const content = draft.trim();
    if (!content) return;
    const s = getSocket();
    s.emit("comment:create", {
      projectId,
      filePath: filterFile || currentFile || "README.md",
      line: line === "" ? null : Number(line),
      content,
      threadId: parent ? parent.threadId : null,
      parentId: parent ? parent.id : null,
    });
    setDraft("");
    setLine("");
    textRef.current?.focus();
  }

  function toggleResolve(threadId: string, resolved: boolean) {
    getSocket().emit("comment:resolve", { projectId, threadId, resolved });
  }

  return (
    <div className="border rounded bg-background h-72 grid grid-rows-[auto_1fr_auto]">
      <div className="px-3 py-2 text-xs border-b flex items-center gap-2">
        <div className="font-medium">Comments</div>
        <input
          className="text-xs px-2 py-0.5 border rounded bg-background w-56"
          placeholder="Filter by file path…"
          value={filterFile}
          onChange={(e) => setFilterFile(e.target.value)}
        />
      </div>

      <div className="p-3 overflow-auto text-xs space-y-2">
        {grouped.length === 0 ? (
          <div className="text-muted-foreground">No comments yet.</div>
        ) : (
          grouped.map(([threadId, thread]) => {
            const head = thread[0];
            const unresolved = thread.some((x) => !x.resolved);
            const open = selectedThread === threadId;
            return (
              <div
                key={threadId}
                className={"border rounded p-2 " + (unresolved ? "bg-amber-50/30" : "bg-muted/30")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-medium">{head.filePath}</span>
                    {head.line != null && <span className="ml-1">: {head.line}</span>}
                    <span className="mx-1 text-muted-foreground">—</span>
                    <span className="text-muted-foreground truncate inline-block max-w-[20rem]">
                      {head.content.slice(0, 120)}
                      {head.content.length > 120 ? "…" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="text-[10px] px-2 py-0.5 border rounded"
                      onClick={() => onOpenFile?.(head.filePath, head.line ?? undefined)}
                      title="Open file"
                    >
                      Open
                    </button>
                    <button
                      className="text-[10px] px-2 py-0.5 border rounded"
                      onClick={() => toggleResolve(threadId, unresolved ? true : false)}
                      title={unresolved ? "Mark resolved" : "Mark unresolved"}
                    >
                      {unresolved ? "Resolve" : "Reopen"}
                    </button>
                    <button
                      className="text-[10px] px-2 py-0.5 border rounded"
                      onClick={() => setSelectedThread(open ? null : threadId)}
                      title="Toggle thread"
                    >
                      {open ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="mt-2 space-y-2">
                    {thread.map((c) => (
                      <div key={c.id} className="border rounded p-2 bg-background">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.username || "user"}</span>
                          <span className="text-muted-foreground">
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                          {c.resolved && (
                            <span className="text-[10px] text-green-700 ml-1">resolved</span>
                          )}
                        </div>
                        <div>{c.content}</div>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <textarea
                        ref={textRef}
                        className="flex-1 border rounded px-2 py-1 text-xs bg-background resize-y min-h-[2rem] max-h-[8rem]"
                        placeholder="Reply…"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            createComment(thread[thread.length - 1]);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => createComment(thread[thread.length - 1])}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 border-t">
        <div className="flex gap-2">
          <input
            className="w-56 border rounded px-2 py-1 text-xs bg-background"
            placeholder="File path (e.g. src/App.tsx)"
            value={filterFile}
            onChange={(e) => setFilterFile(e.target.value)}
          />
          <input
            className="w-24 border rounded px-2 py-1 text-xs bg-background"
            placeholder="Line"
            value={line}
            onChange={(e) => setLine(e.target.value === "" ? "" : Number(e.target.value))}
          />
          <textarea
            className="flex-1 border rounded px-2 py-1 text-xs bg-background resize-y min-h-[2rem] max-h-[8rem]"
            placeholder="New comment…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                createComment(undefined);
              }
            }}
          />
          <Button size="sm" onClick={() => createComment(undefined)}>Comment</Button>
        </div>
      </div>
    </div>
  );
}
