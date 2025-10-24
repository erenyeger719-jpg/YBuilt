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
};

export default function ProjectChat({ projectId }: { projectId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [members, setMembers] = useState<{ userId: string; username: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [online, setOnline] = useState(0);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [unread, setUnread] = useState(0);
  const activeRef = useRef(true); // “am I looking at this pane right now?”
  const lastSentRef = useRef<number>(0); // naive self-guard for notifications

  // ask for notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const s = getSocket();

    // (optional) send JWT if your client stores it — harmless if absent
    // @ts-ignore
    if (s.auth && !s.auth.token) s.auth.token = localStorage.getItem("jwt") || undefined;

    s.emit("join:project", projectId);
    s.emit("chat:history", { projectId, limit: 50 });

    const onMsg = (m: Msg) => {
      setMsgs((prev) => [...prev, m]);

      // bump unread if not active or page hidden
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

        // desktop ping (skip if permission denied or this was our own send a moment ago)
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            const justSent = Date.now() - (lastSentRef.current || 0) < 600;
            if (!justSent) {
              new Notification(m.username || "Project chat", {
                body: m.content?.slice(0, 120) || "",
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

    const onUsers = (p: {
      projectId: string;
      users: { userId: string; username: string }[];
    }) => {
      if (p.projectId === projectId) setMembers(p.users);
    };

    const onHistory = (p: { projectId: string; msgs: Msg[] }) => {
      if (p.projectId === projectId) setMsgs(p.msgs);
    };

    s.on("chat:message", onMsg);
    s.on("typing:user", onTyping);
    s.on("presence:update", onPresence);
    s.on("presence:users", onUsers);
    s.on("chat:history", onHistory);

    return () => {
      s.emit("leave:project", projectId);
      s.off("chat:message", onMsg);
      s.off("typing:user", onTyping);
      s.off("presence:update", onPresence);
      s.off("presence:users", onUsers);
      s.off("chat:history", onHistory);
    };
  }, [projectId]);

  // auto-scroll to newest message
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  // track focus/visibility → clear unread when user is present
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
      if (!document.hidden) {
        markRead();
      } else {
        markAway();
      }
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
    // highlight @all and any @word
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

  function send() {
    const text = draft.trim();
    if (!text) return;

    // simple slash commands:
    if (text.startsWith("/")) {
      const [cmd, ...rest] = text.slice(1).split(/\s+/);
      const arg = rest.join(" ");
      switch (cmd.toLowerCase()) {
        case "who":
          // local render of current members
          setMsgs((prev) => [
            ...prev,
            { role: "system", content: `Online: ${members.map((m) => m.username).join(", ")}` },
          ]);
          break;
        case "me":
          setMsgs((prev) => [...prev, { role: "user", username: "me", content: `*${arg}*` }]);
          break;
        case "deploy":
          // expects a jobId; reuse your existing API
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
          // cancel latest job for this jobId
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
    // locally this means “I’m active”, keep unread at 0
    activeRef.current = true;
    setUnread(0);
    lastSentRef.current = Date.now();
  }

  return (
    <div
      className="border rounded bg-background h-72 grid grid-rows-[auto_1fr_auto]"
      onMouseEnter={() => {
        // treat hover as "active"; clear unread
        activeRef.current = true;
        if (unread > 0) setUnread(0);
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

      <div ref={boxRef} className="p-3 overflow-auto text-xs space-y-1">
        {msgs.length === 0 ? (
          <div className="text-muted-foreground">Start the conversation…</div>
        ) : (
          msgs.map((m, i) => (
            <div key={m.id || i}>
              <span className="font-medium">{m.username || m.role}:</span>{" "}
              {renderContent(m.content)}
            </div>
          ))
        )}
      </div>

      <div className="p-2 flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1 text-xs bg-background"
          placeholder="Message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          onFocus={() => getSocket().emit("typing:start", { projectId })}
          onBlur={() => getSocket().emit("typing:stop", { projectId })}
        />
        <Button size="sm" onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}
