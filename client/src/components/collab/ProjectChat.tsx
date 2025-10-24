import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";

type Msg = { id?: string; userId?: string; username?: string; role: string; content: string; createdAt?: string };

export default function ProjectChat({ projectId }: { projectId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const s = getSocket();

    // (optional) send JWT if your client stores it — harmless if absent
    // @ts-ignore
    if (s.auth && !s.auth.token) s.auth.token = localStorage.getItem("jwt") || undefined;

    s.emit("join:project", projectId);

    const onMsg = (m: Msg) => setMsgs((prev) => [...prev, m]);
    const onTyping = (p: { username?: string; typing?: boolean }) => {
      // noop for now; wire a tiny “Someone is typing…” text if you want
    };

    s.on("chat:message", onMsg);
    s.on("typing:user", onTyping);

    return () => {
      s.emit("leave:project", projectId);
      s.off("chat:message", onMsg);
      s.off("typing:user", onTyping);
    };
  }, [projectId]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const s = getSocket();
    s.emit("chat:collaboration", { projectId, message: text });
    setDraft("");
  }

  return (
    <div className="border rounded bg-background h-72 grid grid-rows-[1fr_auto]">
      <div ref={boxRef} className="p-3 overflow-auto text-xs space-y-1">
        {msgs.length === 0 ? (
          <div className="text-muted-foreground">Start the conversation…</div>
        ) : (
          msgs.map((m, i) => (
            <div key={m.id || i}>
              <span className="font-medium">{m.username || m.role}:</span> {m.content}
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
        <Button size="sm" onClick={send}>Send</Button>
      </div>
    </div>
  );
}
