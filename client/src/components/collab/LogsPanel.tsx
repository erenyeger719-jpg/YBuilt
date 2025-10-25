import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";

type DeployEvent =
  | { type: "log"; line: string; ts: number; user?: string }
  | { type: "stage"; name: string; ts: number }
  | { type: "done"; ok: boolean; url?: string; ts: number }
  | { type: "chat"; user: string; text: string; ts: number }
  | { [k: string]: any }; // tolerate unknowns

export default function LogsPanel() {
  const [jobId, setJobId] = useState("");
  const [joined, setJoined] = useState<string | null>(null);
  const [events, setEvents] = useState<DeployEvent[]>([]);
  const [draft, setDraft] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const s = getSocket();
    const onEvt = (e: DeployEvent) => setEvents((prev) => [...prev, e]);
    s.on("deploy:event", onEvt);
    return () => s.off("deploy:event", onEvt);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length]);

  function join() {
    if (!jobId.trim()) return;
    const s = getSocket();
    s.emit("deploy:join", { jobId: jobId.trim() });
    setJoined(jobId.trim());
    setEvents([]);
  }

  function leave() {
    if (!joined) return;
    const s = getSocket();
    s.emit("deploy:leave", { jobId: joined });
    setJoined(null);
    setEvents([]);
  }

  function sendChat() {
    const text = draft.trim();
    if (!text || !joined) return;
    const s = getSocket();
    s.emit("deploy:chat", { jobId: joined, text });
    setDraft("");
  }

  return (
    <div className="border rounded bg-background h-72 grid grid-rows-[auto_1fr_auto]">
      <div className="px-3 py-2 text-xs border-b flex items-center gap-2">
        <div className="font-medium">Deploy Logs</div>
        <input
          className="text-xs px-2 py-0.5 border rounded bg-background w-56"
          placeholder="Job ID (room)"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
        />
        {joined ? (
          <Button size="sm" variant="secondary" onClick={leave}>Leave</Button>
        ) : (
          <Button size="sm" onClick={join}>Join</Button>
        )}
        {joined && <span className="text-muted-foreground">• joined: {joined}</span>}
      </div>

      <div ref={boxRef} className="p-3 overflow-auto text-xs space-y-1">
        {events.length === 0 ? (
          <div className="text-muted-foreground">No events yet.</div>
        ) : (
          events.map((e, i) => {
            if (e.type === "log") {
              return <div key={i} className="font-mono whitespace-pre-wrap">{e.line}</div>;
            }
            if (e.type === "stage") {
              return <div key={i} className="text-amber-700">▶ {e.name}</div>;
            }
            if (e.type === "done") {
              return (
                <div key={i} className={e.ok ? "text-green-700" : "text-red-700"}>
                  ✓ done {e.ok ? "OK" : "FAILED"}{e.url ? ` — ${e.url}` : ""}
                </div>
              );
            }
            if (e.type === "chat") {
              return (
                <div key={i} className="text-blue-700">
                  💬 {e.user || "user"}: {e.text}
                </div>
              );
            }
            return <div key={i} className="text-muted-foreground">• {JSON.stringify(e)}</div>;
          })
        )}
      </div>

      <div className="p-2 border-t">
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-2 py-1 text-xs bg-background"
            placeholder={joined ? "Send a chat line to this job…" : "Join a job to chat…"}
            disabled={!joined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendChat();
              }
            }}
          />
          <Button size="sm" onClick={sendChat} disabled={!joined || !draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
