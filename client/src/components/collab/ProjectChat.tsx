import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";

type Msg = {
  id?: string;
  userId?: string;
  username?: string;
  role: string;
  content: string;
  createdAt?: string;
  reactions?: Record<string, number>;
  editedAt?: string;
  deleted?: boolean;
  pinned?: boolean; // <-- added
};

const EMOJIS = ["👍", "🎉", "❤️", "😂", "✅"];

export default function ProjectChat({ projectId }: { projectId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [members, setMembers] = useState<{ userId: string; username: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [online, setOnline] = useState(0);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [unread, setUnread] = useState(0);
  const activeRef = useRef(true);
  const lastSentRef = useRef<number>(0);

  // mention
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  // scroll
  const [atBottom, setAtBottom] = useState(true);
  const [pendingNew, setPendingNew] = useState(0);
  const atBottomRef = useRef(true);

  // local "I reacted" memory (not persisted)
  const [myReacts, setMyReacts] = useState<Set<string>>(new Set());

  // me + edit state
  const [me, setMe] = useState<{ userId?: string; email?: string }>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // ---- Local cache: load first (before joining), then save on every change ----
  useEffect(() => {
    if (!projectId) return;
    try {
      const raw = localStorage.getItem(`proj-chat:${projectId}`);
      if (raw) setMsgs(JSON.parse(raw));
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    try {
      const slice = msgs.slice(-200);
      localStorage.setItem(`proj-chat:${projectId}`, JSON.stringify(slice));
    } catch {}
  }, [projectId, msgs]);

  // ask for notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // decode JWT once to know "me" (handle unpadded base64url)
  useEffect(() => {
    try {
      const t = localStorage.getItem("jwt");
      if (!t) return;
      const b64 = t.split(".")[1] || "";
      const b64url = b64.replace(/-/g, "+").replace(/_/g, "/");
      const padLen = (4 - (b64url.length % 4)) % 4;
      const padded = b64url + "=".repeat(padLen);
      const payload = JSON.parse(atob(padded));
      setMe({ userId: String(payload.sub), email: payload.email });
    } catch {}
  }, []);

  // track scroll position
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
      setAtBottom(nearBottom);
      atBottomRef.current = nearBottom; // keep ref synced
      if (nearBottom) setPendingNew(0);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const s = getSocket();
    // @ts-ignore
    if (s.auth && !s.auth.token) s.auth.token = localStorage.getItem("jwt") || undefined;

    s.emit("join:project", projectId);
    s.emit("chat:history", { projectId, limit: 50 });

    const onMsg = (m: Msg) => {
      setMsgs((prev) => [...prev, m]);

      // use ref so effect doesn't depend on atBottom
      if (!atBottomRef.current) setPendingNew((n) => n + 1);

      const notActive = !activeRef.current || document.hidden;
      if (notActive) {
        setUnread((prev) => {
          const next = prev + 1;
          try {
            const anyDoc = document as any;
            const base = anyDoc.__baseTitle || document.title;
            anyDoc.__baseTitle = base;
            document.title = `(${next}) ${base}`;
          } catch {}
          return next;
        });
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            const justSent = Date.now() - (lastSentRef.current || 0) < 600;
            if (!justSent) {
              new Notification(m.username || "Project chat", {
                body: m.content?.slice(0, 120) || "",
                tag: `proj:${projectId}`,
              });
            }
          }
        } catch {}
      }
    };

    const onTyping = (p: { username?: string; typing?: boolean }) => {
      const name = p.username || "Someone";
      setTypingNames((prev) => {
        const set = new Set(prev);
        p.typing ? set.add(name) : set.delete(name);
        return Array.from(set);
      });
    };

    const onPresence = (p: { projectId: string; count: number }) => {
      if (p.projectId === projectId) setOnline(p.count);
    };

    const onUsers = (p: { projectId: string; users: { userId: string; username: string }[] }) => {
      if (p.projectId === projectId) setMembers(p.users);
    };

    const onHistory = (p: { projectId: string; msgs: Msg[] }) => {
      if (p.projectId !== projectId) return;
      setMsgs(p.msgs);
      try {
        localStorage.setItem(`proj-chat:${projectId}`, JSON.stringify(p.msgs.slice(-200)));
      } catch {}
    };

    const onReactUpdate = (p: { messageId: string; counts: Record<string, number> }) => {
      setMsgs((prev) =>
        prev.map((m) => (m.id === p.messageId ? { ...m, reactions: p.counts } : m))
      );
    };

    const onMsgUpdate = (p: {
      id: string;
      projectId: string;
      content: string;
      editedAt?: string;
    }) => {
      if (p.projectId !== projectId) return;
      setMsgs((prev) =>
        prev.map((m) => (m.id === p.id ? { ...m, content: p.content, editedAt: p.editedAt } : m))
      );
    };

    const onMsgDelete = (p: { id: string; projectId: string; deletedAt?: string }) => {
      if (p.projectId !== projectId) return;
      setMsgs((prev) => prev.map((m) => (m.id === p.id ? { ...m, deleted: true } : m)));
    };

    // NEW: pin updates
    const onPinUpdate = (p: { id: string; projectId: string; pinned: boolean }) => {
      if (p.projectId !== projectId) return;
      setMsgs((prev) => prev.map((m) => (m.id === p.id ? { ...m, pinned: p.pinned } : m)));
    };

    s.on("chat:message", onMsg);
    s.on("typing:user", onTyping);
    s.on("presence:update", onPresence);
    s.on("presence:users", onUsers);
    s.on("chat:history", onHistory);
    s.on("chat:react:update", onReactUpdate);
    s.on("chat:message:update", onMsgUpdate);
    s.on("chat:message:delete", onMsgDelete);
    s.on("chat:pin:update", onPinUpdate); // <-- added

    return () => {
      s.emit("leave:project", projectId);
      s.off("chat:message", onMsg);
      s.off("typing:user", onTyping);
      s.off("presence:update", onPresence);
      s.off("presence:users", onUsers);
      s.off("chat:history", onHistory);
      s.off("chat:react:update", onReactUpdate);
      s.off("chat:message:update", onMsgUpdate);
      s.off("chat:message:delete", onMsgDelete);
      s.off("chat:pin:update", onPinUpdate); // <-- added
    };
  }, [projectId]);

  // react when you're mentioned
  useEffect(() => {
    if (!projectId) return;
    const s = getSocket();

    const onMention = (p: { projectId: string; from: string; content: string; at: number }) => {
      if (p.projectId !== projectId) return;
      setMsgs((prev) => [
        ...prev,
        {
          role: "system",
          content: `@you from ${p.from}: ${p.content}`,
          createdAt: new Date(p.at).toISOString(),
        },
      ]);
    };

    s.on("chat:mention", onMention);
    return () => s.off("chat:mention", onMention);
  }, [projectId]);

  // auto-scroll to newest message when at bottom
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [msgs.length, atBottom]);

  // track focus/visibility → clear unread when present
  useEffect(() => {
    function restoreTitle() {
      try {
        const anyDoc = document as any;
        const base = anyDoc.__baseTitle || document.title.replace(/^\(\d+\)\s+/, "");
        document.title = base;
        anyDoc.__baseTitle = base;
      } catch {}
    }
    function markRead() {
      activeRef.current = true;
      if (unread > 0) {
        setUnread(0);
        restoreTitle();
      }
    }
    function markAway() {
      activeRef.current = false;
    }
    function handleVisibility() {
      if (!document.hidden) markRead();
      else markAway();
    }

    window.addEventListener("focus", markRead);
    window.addEventListener("blur", markAway);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", markRead);
      window.removeEventListener("blur", markAway);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [unread]);

  function renderContent(text: string) {
    const parts = text.split(/(\B@[\w-]+)/g);
    return parts.map((p, i) => {
      if (/^\B@[\w-]+$/.test(p)) {
        const isAll = p.toLowerCase() === "@all";
        return (
          <span
            key={i}
            className={"rounded px-1 " + (isAll ? "bg-red-100 text-red-700" : "bg-yellow-100")}
          >
            {p}
          </span>
        );
      }
      return <span key={i}>{p}</span>;
    });
  }

  // insert text at cursor
  function insertAtCursor(val: string) {
    const el = inputRef.current;
    if (!el) return setDraft((d) => d + val);
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const before = draft.slice(0, start);
    const after = draft.slice(end);
    const next = before + val + after;
    setDraft(next);
    requestAnimationFrame(() => {
      el.setSelectionRange(start + val.length, start + val.length);
      el.focus();
    });
  }

  function clearUnread() {
    setUnread(0);
    try {
      const anyDoc = document as any;
      const base = anyDoc.__baseTitle || document.title.replace(/^\(\d+\)\s+/, "");
      document.title = base;
      anyDoc.__baseTitle = base;
    } catch {}
  }

  // permissions + edit helpers
  function canEditOrDelete(m: Msg) {
    if (!m.id || !m.userId || !m.createdAt || m.deleted) return false;
    if (!me.userId || String(me.userId) !== String(m.userId)) return false;
    const age = Date.now() - new Date(m.createdAt).getTime();
    return age <= 10 * 60 * 1000; // 10 minutes
  }
  function startEdit(m: Msg) {
    setEditingId(m.id!);
    setEditText(m.content);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }
  function saveEdit() {
    if (!editingId) return;
    const content = editText.trim();
    if (!content) return;
    getSocket().emit("chat:message:update", { projectId, messageId: editingId, content });
    setEditingId(null);
    setEditText("");
  }
  function deleteMsg(id?: string) {
    if (!id) return;
    getSocket().emit("chat:message:delete", { projectId, messageId: id });
  }

  // NEW: toggle pin helper
  function togglePin(m: Msg) {
    if (!m.id) return;
    const op = m.pinned ? "unpin" : "pin";
    getSocket().emit("chat:pin", { projectId, messageId: m.id, op });
  }

  // toggle a reaction (optimistic)
  function toggleReact(messageId?: string, emoji?: string) {
    if (!messageId || !emoji) return;
    const key = `${messageId}:${emoji}`;
    const has = myReacts.has(key);
    const op: "add" | "remove" = has ? "remove" : "add";

    // optimistic local bump
    setMsgs((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const counts = { ...(m.reactions || {}) };
        const cur = counts[emoji] || 0;
        counts[emoji] = Math.max(0, cur + (op === "add" ? 1 : -1));
        return { ...m, reactions: counts };
      })
    );
    setMyReacts((prev) => {
      const next = new Set(prev);
      if (has) next.delete(key);
      else next.add(key);
      return next;
    });

    getSocket().emit("chat:react", { projectId, messageId, emoji, op });
  }

  function send() {
    const text = draft.trim();
    if (!text) return;

    // slash commands
    if (text.startsWith("/")) {
      const [cmd, ...rest] = text.slice(1).split(/\s+/);
      const arg = rest.join(" ");
      switch (cmd.toLowerCase()) {
        case "help":
          setMsgs((prev) => [
            ...prev,
            {
              role: "system",
              content: "Commands: /who, /me <text>, /deploy <jobId>, /cancel <jobId>",
            },
          ]);
          break;
        case "who": {
          const list = members.map((m) => m.username).join(", ") || "just you";
          setMsgs((prev) => [...prev, { role: "system", content: `Online: ${list}` }]);
          break;
        }
        case "me":
          setMsgs((prev) => [...prev, { role: "user", username: "me", content: `*${arg}*` }]);
          break;
        case "deploy":
          fetch("/api/deploy/enqueue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ provider: "netlify", previewPath: `/previews/${arg}/` }),
          })
            .then((r) => r.json())
            .then((d) => {
              const ok = d?.ok ? "queued" : `failed: ${d?.error || "unknown"}`;
              setMsgs((prev) => [...prev, { role: "system", content: `deploy ${ok}` }]);
            })
            .catch(() =>
              setMsgs((prev) => [...prev, { role: "system", content: "deploy failed" }])
            );
          break;
        case "cancel":
          fetch("/api/deploy/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ clientRoom: arg }),
          })
            .then((r) => r.json())
            .then((d) => {
              const ok = d?.ok ? "requested" : `failed: ${d?.error || "unknown"}`;
              setMsgs((prev) => [...prev, { role: "system", content: `cancel ${ok}` }]);
            })
            .catch(() =>
              setMsgs((prev) => [...prev, { role: "system", content: "cancel failed" }])
            );
          break;
        default:
          setMsgs((prev) => [...prev, { role: "system", content: `unknown command: /${cmd}` }]);
      }
      setDraft("");
      return;
    }

    const s = getSocket();
    s.emit("chat:collaboration", { projectId, message: text });
    s.emit("typing:stop", { projectId });
    setDraft("");
    activeRef.current = true;
    clearUnread();
    lastSentRef.current = Date.now();
  }

  // mention options (max 8)
  const mentionOptions = members
    .map((m) => m.username.split("@")[0])
    .filter((name) => name.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 8);
  const activeIdx = mentionOptions.length ? mentionIndex % mentionOptions.length : 0;

  return (
    <div
      className="border rounded bg-background h-72 grid grid-rows-[auto_1fr_auto]"
      onMouseEnter={() => {
        activeRef.current = true;
        if (unread > 0) clearUnread();
      }}
    >
      <div className="px-3 py-2 text-xs border-b flex items-center gap-2">
        <div className="font-medium">Project Chat</div>
        <div className="text-muted-foreground">• {online} online</div>
        {members.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {members.slice(0, 5).map((m) => (
              <span key={m.userId} className="px-1 rounded bg-muted">
                {m.username.split("@")[0]}
              </span>
            ))}
            {members.length > 5 && <span>+{members.length - 5}</span>}
          </div>
        )}
        {unread > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            {unread} new
          </span>
        )}
        {typingNames.length > 0 && (
          <div className="ml-auto text-muted-foreground">{typingNames.join(", ")} typing…</div>
        )}
      </div>

      <div className="relative">
        <div ref={boxRef} className="p-3 overflow-auto text-xs space-y-2 h-40">
          {msgs.length === 0 ? (
            <div className="text-muted-foreground">Start the conversation…</div>
          ) : (
            msgs.map((m, i) => (
              <div key={m.id || i} className="group">
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-medium">{m.username || m.role}</span>
                      <span className="text-muted-foreground">
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                      {m.editedAt && !m.deleted && (
                        <span className="text-muted-foreground text-[10px]">(edited)</span>
                      )}
                      {m.pinned && !m.deleted && (
                        <span className="text-yellow-600 text-[10px] ml-1">★ pinned</span>
                      )}
                    </div>

                    <div className={m.deleted ? "text-muted-foreground italic" : ""}>
                      {m.deleted ? "message deleted" : renderContent(m.content)}
                    </div>
                  </div>

                  {/* Actions: pin for everyone, edit/delete for own msgs within window */}
                  {!m.deleted && (
                    <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                      <button
                        type="button"
                        className={
                          "text-xs px-2 py-0.5 border rounded " +
                          (m.pinned ? "bg-yellow-50 border-yellow-300" : "")
                        }
                        onClick={() => togglePin(m)}
                        title={m.pinned ? "Unpin" : "Pin"}
                      >
                        {m.pinned ? "★ Unpin" : "☆ Pin"}
                      </button>

                      {canEditOrDelete(m) &&
                        (editingId === m.id ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="text-xs px-2 py-0.5 border rounded"
                              onClick={saveEdit}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-0.5 border rounded"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="text-xs px-2 py-0.5 border rounded"
                              onClick={() => startEdit(m)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-0.5 border rounded"
                              onClick={() => deleteMsg(m.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Inline edit field */}
                {editingId === m.id && (
                  <div className="mt-1">
                    <textarea
                      className="w-full border rounded px-2 py-1 text-xs bg-background resize-y min-h-[2rem] max-h-[8rem]"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                )}

                {/* Reactions bar (skip system/deleted) */}
                {m.id && m.role !== "system" && !m.deleted && (
                  <div className="mt-0.5 flex items-center gap-2 opacity-80 group-hover:opacity-100">
                    {EMOJIS.map((e) => {
                      const count = m.reactions?.[e] || 0;
                      const mine = myReacts.has(`${m.id}:${e}`);
                      return (
                        <button
                          key={e}
                          type="button"
                          className={
                            "border rounded-full px-1.5 py-0.5 text-[10px] " +
                            (mine ? "bg-blue-50 border-blue-300" : "bg-muted")
                          }
                          onClick={() => toggleReact(m.id, e)}
                          title={e}
                        >
                          {e} {count > 0 ? count : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!atBottom && pendingNew > 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <button
              type="button"
              className="rounded-full bg-blue-600 text-white text-xs px-3 py-1 shadow"
              onClick={() => {
                const el = boxRef.current;
                if (!el) return;
                el.scrollTop = el.scrollHeight;
                setAtBottom(true);
                atBottomRef.current = true;
                setPendingNew(0);
              }}
            >
              {pendingNew} new — Jump to latest
            </button>
          </div>
        )}
      </div>

      <div className="p-2">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 border rounded px-2 py-1 text-xs bg-background resize-y min-h-[2rem] max-h-[8rem]"
            placeholder="Message…"
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              setDraft(v);

              const caret = e.target.selectionStart ?? v.length;
              const upto = v.slice(0, caret);
              const m = upto.match(/(^|\s)@([\w-]{0,32})$/);
              if (m) {
                setMentionOpen(true);
                setMentionQuery(m[2] || "");
                setMentionIndex(0);
              } else {
                setMentionOpen(false);
                setMentionQuery("");
                setMentionIndex(0);
              }
              getSocket().emit("typing:start", { projectId });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                if (mentionOpen) {
                  e.preventDefault();
                  const picked = mentionOptions[activeIdx] || mentionQuery || "";
                  if (picked) {
                    const caret =
                      (e.currentTarget as HTMLTextAreaElement).selectionStart ?? draft.length;
                    const upto = draft.slice(0, caret);
                    const rest = draft.slice(caret);
                    const repl = upto.replace(/(@[\w-]{0,32})$/, `@${picked} `);
                    setDraft(repl + rest);
                    setMentionOpen(false);
                    setMentionQuery("");
                    setMentionIndex(0);
                    return;
                  }
                }
                e.preventDefault();
                send();
                return;
              }

              if (mentionOpen) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => i + 1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => Math.max(0, i - 1));
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setMentionOpen(false);
                }
              }
            }}
            onFocus={() => getSocket().emit("typing:start", { projectId })}
            onBlur={() => getSocket().emit("typing:stop", { projectId })}
          />
          <Button size="sm" onClick={send}>
            Send
          </Button>
        </div>

        {mentionOpen && (
          <div className="px-0.5 pb-2 -mt-1 w-full">
            <div className="border rounded bg-popover text-xs max-h-[10rem] overflow-auto">
              {mentionOptions.length > 0 ? (
                mentionOptions.map((name, idx) => (
                  <div
                    key={name}
                    className={
                      "px-2 py-1 cursor-pointer " + (idx === activeIdx ? "bg-muted" : "")
                    }
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertAtCursor(`@${name} `);
                      setMentionOpen(false);
                      setMentionQuery("");
                      setMentionIndex(0);
                    }}
                  >
                    @{name}
                  </div>
                ))
              ) : (
                <div className="px-2 py-1 text-muted-foreground">No matches</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
