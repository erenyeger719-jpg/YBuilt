import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";

type Attachment = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

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
  pinned?: boolean;
  attachments?: Attachment[]; // <-- NEW
};

const EMOJIS = ["👍", "🎉", "❤️", "😂", "✅"];

export default function ProjectChat({ projectId }: { projectId: string }) {
  // helper: normalize a username to a "handle"
  function handleOf(s?: string) {
    return (s || "").split("@")[0].replace(/[^a-z0-9_-]/gi, "-");
  }

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

  // pins tray
  const [showPins, setShowPins] = useState(false);
  const pinnedMsgs = msgs.filter((m) => m.pinned && !m.deleted);

  // search
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<string[]>([]);
  const [hitIdx, setHitIdx] = useState(0);

  // draft attachments
  const [draftFiles, setDraftFiles] = useState<Attachment[]>([]);
  const MAX_FILES = 3;
  const MAX_BYTES = 2_000_000; // ~2MB each (v1 guard)

  function fileToDataUrl(file: File): Promise<Attachment> {
    return new Promise((res, rej) => {
      if (file.size > MAX_BYTES) return rej(new Error("Too big"));
      const reader = new FileReader();
      reader.onerror = () => rej(new Error("Failed to read file"));
      reader.onload = () => {
        res({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: String(reader.result),
        });
      };
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    const room = MAX_FILES - draftFiles.length;
    if (room <= 0) return;
    const picked = arr.slice(0, room);
    const out: Attachment[] = [];
    for (const f of picked) {
      try {
        const a = await fileToDataUrl(f);
        out.push(a);
      } catch {}
    }
    if (out.length) setDraftFiles((prev) => [...prev, ...out]);
  }

  function removeDraftFile(idx: number) {
    setDraftFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // recompute hits when msgs or query change
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setHits([]);
      setHitIdx(0);
      return;
    }
    const ids = msgs
      .filter(
        (m) =>
          !m.deleted &&
          !!m.id &&
          ((m.content || "").toLowerCase().includes(q) ||
            (m.username || "").toLowerCase().includes(q))
      )
      .map((m) => m.id!);
    setHits(ids);
    setHitIdx(0);
  }, [query, msgs]);

  function nextHit() {
    if (!hits.length) return;
    setHitIdx((i) => (i + 1) % hits.length);
  }
  function prevHit() {
    if (!hits.length) return;
    setHitIdx((i) => (i - 1 + hits.length) % hits.length);
  }

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
      // strip attachments before caching
      const slice = msgs.slice(-200).map(({ attachments, ...rest }) => rest);
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

  // jump to hash (permalink) on mount
  useEffect(() => {
    const h = window.location.hash;
    if (!h || !boxRef.current) return;
    setQuery(""); // ensure no pre-filter hides the target
    const el = document.getElementById(h.slice(1));
    if (el) el.scrollIntoView({ block: "center" });
  }, []);

  // auto-jump when the current hit changes
  useEffect(() => {
    if (!hits.length) return;
    const id = hits[hitIdx];
    const t = setTimeout(() => jumpTo(id), 0);
    return () => clearTimeout(t);
  }, [hits, hitIdx]);

  useEffect(() => {
    if (!projectId) return;
    const s = getSocket();

    // Ensure auth token is set before the socket connects (avoid 401 on anon connect)
    // @ts-ignore
    const tok = localStorage.getItem("jwt") || undefined;
    // @ts-ignore
    if (s.auth && !s.auth.token && tok) {
      s.disconnect();
      // @ts-ignore
      s.auth.token = tok;
      s.connect();
    }

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
        const clean = p.msgs.slice(-200).map(({ attachments, ...rest }) => rest);
        localStorage.setItem(`proj-chat:${projectId}`, JSON.stringify(clean));
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

    // pin updates
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
    s.on("chat:pin:update", onPinUpdate);

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
      s.off("chat:pin:update", onPinUpdate);
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
    const urlRx = /(https?:\/\/[^\s)]+)(?=[\s)|]?)/gi;
    const parts = text.split(/(\B@[\w-]+)/g);

    return parts.map((p, i) => {
      // mentions
      if (/^\B@[\w-]+$/.test(p)) {
        const isAll = p.toLowerCase() === "@all";
        return (
          <span
            key={"m" + i}
            className={"rounded px-1 " + (isAll ? "bg-red-100 text-red-700" : "bg-yellow-100")}
          >
            {p}
          </span>
        );
      }

      // linkify the rest
      const chunks = p.split(urlRx);
      return chunks.map((c, j) => {
        if (/^https?:\/\//i.test(c)) {
          return (
            <a
              key={"u" + i + "-" + j}
              href={c}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {c}
            </a>
          );
        }
        return <span key={"t" + i + "-" + j}>{c}</span>;
      });
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

  // toggle pin helper
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
    if (!text && draftFiles.length === 0) return; // allow attachments-only

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
    s.emit("chat:collaboration", {
      projectId,
      message: text,
      attachments: draftFiles, // <-- NEW
    });
    s.emit("typing:stop", { projectId });
    setDraft("");
    setDraftFiles([]); // <-- NEW
    activeRef.current = true;
    clearUnread();
    lastSentRef.current = Date.now();
  }

  // mention options (max 8)
  const mentionOptions = members
    .map((m) => handleOf(m.username))
    .filter((name) => name.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 8);
  const activeIdx = mentionOptions.length ? mentionIndex % mentionOptions.length : 0;

  function jumpTo(id?: string) {
    if (!id) return;
    const el = document.getElementById(`m-${id}`);
    if (el) el.scrollIntoView({ block: "center" });
    setShowPins(false);
  }

  return (
    <div
      className="border rounded bg-background h-72 grid grid-rows-[auto_auto_1fr_auto]"
      onMouseEnter={() => {
        activeRef.current = true;
        if (unread > 0) clearUnread();
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={async (e) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length) await addFiles(files);
      }}
    >
      <div className="px-3 py-2 text-xs border-b flex items-center gap-2">
        <div className="font-medium">Project Chat</div>
        <div className="text-muted-foreground">• {online} online</div>
        {members.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {members.slice(0, 5).map((m) => (
              <span key={m.userId} className="px-1 rounded bg-muted">
                {handleOf(m.username)}
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
        {pinnedMsgs.length > 0 && (
          <button
            type="button"
            className="ml-2 text-[10px] px-2 py-0.5 border rounded bg-yellow-50 border-yellow-300"
            onClick={() => setShowPins((v) => !v)}
            title="Show pinned"
          >
            ★ {pinnedMsgs.length} pinned
          </button>
        )}

        {/* Search */}
        <div className="ml-2 flex items-center gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="text-xs px-2 py-0.5 border rounded bg-background w-40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits.length) {
                e.preventDefault();
                nextHit();
              } else if (e.key === "Escape") {
                setQuery("");
              }
            }}
          />
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {hits.length > 0 ? `${hitIdx + 1}/${hits.length}` : "0/0"}
          </div>
          <button
            type="button"
            className="text-[10px] px-2 py-0.5 border rounded"
            onClick={prevHit}
            disabled={!hits.length}
            title="Previous match"
          >
            ↑
          </button>
          <button
            type="button"
            className="text-[10px] px-2 py-0.5 border rounded"
            onClick={nextHit}
            disabled={!hits.length}
            title="Next match"
          >
            ↓
          </button>
        </div>

        {typingNames.length > 0 && (
          <div className="ml-auto text-muted-foreground">{typingNames.join(", ")} typing…</div>
        )}
      </div>

      {showPins && (
        <div className="px-3 py-2 text-xs border-b bg-muted/40 max-h-28 overflow-auto">
          {pinnedMsgs.map((pm) => (
            <div key={pm.id} className="flex items-center justify-between gap-2 py-1">
              <div className="truncate">
                <span className="font-medium">{handleOf(pm.username) || pm.role}</span>
                <span className="mx-1">—</span>
                <span className="text-muted-foreground">
                  {pm.content.slice(0, 80)}
                  {pm.content.length > 80 ? "…" : ""}
                </span>
              </div>
              <button
                type="button"
                className="text-[10px] px-2 py-0.5 border rounded"
                onClick={() => jumpTo(pm.id)}
              >
                Jump
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Draft attachment preview tray */}
      {draftFiles.length > 0 && (
        <div className="px-3 py-2 text-xs border-b bg-muted/30">
          <div className="flex flex-wrap gap-2">
            {draftFiles.map((f, idx) => {
              const isImg = f.type.startsWith("image/");
              return (
                <div key={idx} className="border rounded p-1 flex items-center gap-2 bg-background">
                  {isImg ? (
                    <img src={f.dataUrl} alt={f.name} className="h-10 w-10 object-cover rounded" />
                  ) : (
                    <div className="h-10 w-10 grid place-items-center rounded bg-muted">📎</div>
                  )}
                  <div className="max-w-[16rem] truncate">
                    <div className="font-medium truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {(f.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-[10px] px-2 py-0.5 border rounded"
                    onClick={() => removeDraftFile(idx)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {draftFiles.length}/{MAX_FILES} attached — images preview inline
          </div>
        </div>
      )}

      <div className="relative">
        <div ref={boxRef} className="p-3 overflow-auto text-xs space-y-2 h-40">
          {msgs.length === 0 ? (
            <div className="text-muted-foreground">Start the conversation…</div>
          ) : (
            msgs.map((m, i) => {
              const q = query.trim().toLowerCase();
              const isHit =
                !!q &&
                !m.deleted &&
                (((m.content || "").toLowerCase().includes(q) ||
                  (m.username || "").toLowerCase().includes(q)));
              const isCurrent = !!m.id && hits.length > 0 && m.id === hits[hitIdx];

              return (
                <div
                  key={m.id || i}
                  id={m.id ? `m-${m.id}` : undefined}
                  className={
                    "group rounded " +
                    (isCurrent
                      ? "ring-1 ring-blue-400 bg-blue-50/40"
                      : isHit
                      ? "bg-amber-50/40"
                      : "")
                  }
                >
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

                      {/* Attachments */}
                      {!m.deleted && Array.isArray(m.attachments) && m.attachments.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {m.attachments.map((a, i2) => {
                            const isImg = (a.type || "").startsWith("image/");
                            return (
                              <div key={i2} className="border rounded bg-background p-1">
                                {isImg ? (
                                  <a
                                    href={a.dataUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={a.name}
                                  >
                                    <img src={a.dataUrl} alt={a.name} className="max-h-32 rounded" />
                                  </a>
                                ) : (
                                  <a
                                    href={a.dataUrl}
                                    download={a.name}
                                    className="underline hover:no-underline"
                                    title={`${a.name} (${(a.size / 1024).toFixed(0)} KB)`}
                                  >
                                    📎 {a.name}
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
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

                        <button
                          type="button"
                          className="text-xs px-2 py-0.5 border rounded"
                          onClick={() => {
                            if (!m.id) return;
                            const url = new URL(window.location.href);
                            url.hash = `m-${m.id}`;
                            navigator.clipboard.writeText(url.toString()).catch(() => {});
                          }}
                          title="Copy message link"
                        >
                          Link
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
              );
            })
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
            onPaste={async (e) => {
              const files = e.clipboardData?.files;
              const txt = e.clipboardData?.getData("text/plain") || "";
              if (txt) insertAtCursor(txt);
              if (files && files.length) {
                await addFiles(files);
                e.preventDefault(); // avoid double-inserting after manual insert
              }
            }}
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
                    className={"px-2 py-1 cursor-pointer " + (idx === activeIdx ? "bg-muted" : "")}
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
