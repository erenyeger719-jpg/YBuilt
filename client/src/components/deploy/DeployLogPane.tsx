import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ChatMsg = { user: string; text: string; ts: number };

export default function DeployLogPane({ jobId }: { jobId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [stage, setStage] = useState<string>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [adminUrl, setAdminUrl] = useState<string | null>(null);
  const promptedRef = useRef(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");

  // Load persisted chat for this job
  useEffect(() => {
    if (!jobId) return;
    try {
      const raw = localStorage.getItem(`deploy-chat:${jobId}`);
      if (raw) setChat(JSON.parse(raw));
    } catch {}
  }, [jobId]);

  // Persist chat (cap to last 200 messages)
  useEffect(() => {
    if (!jobId) return;
    try {
      localStorage.setItem(`deploy-chat:${jobId}`, JSON.stringify(chat.slice(-200)));
    } catch {}
  }, [chat, jobId]);

  useEffect(() => {
    if (!jobId) return;
    const s = getSocket();
    s.emit("deploy:join", { jobId });

    const onEvt = (p: any) => {
      if (p?.type === "log" && typeof p.line === "string") {
        setLines((prev) => [...prev, p.line]);
      }
      if (p?.type === "stage") {
        setStage(p.stage || "");
      }
      if (p?.type === "chat") {
        setChat((prev) => [
          ...prev,
          {
            user: p.user || "anon",
            text: String(p.text || ""),
            ts: p.ts || Date.now(),
          },
        ]);
      }
      if (p?.type === "done") {
        setStage("done");

        // Error branch: show failure toast and stop.
        if (p?.status === "error") {
          toast({
            title: "Deploy failed",
            description: p?.error || "Unknown error",
            variant: "destructive",
          });
          return;
        }
        // Cancelled branch
        if (p?.status === "cancelled") {
          toast({ title: "Deploy cancelled" });
          return;
        }

        if (p?.url) setUrl(p.url);
        if (p?.adminUrl) setAdminUrl(p.adminUrl);

        // Success branch: notify and offer to open the deployed site — only once
        if (p?.url && !promptedRef.current) {
          promptedRef.current = true;
          toast({
            title: "Deploy complete",
            description: p.url,
          });
          setTimeout(() => {
            const openNow = confirm("Open deployed site?");
            if (openNow) window.open(p.url, "_blank");
          }, 0);
        }
      }

      // autoscroll logs
      requestAnimationFrame(() => {
        const el = boxRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    };

    s.on("deploy:event", onEvt);

    return () => {
      s.emit("deploy:leave", { jobId });
      s.off("deploy:event", onEvt);
    };
  }, [jobId, toast]);

  function copyAll() {
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function downloadLogs() {
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `deploy-${jobId}-${ts}.log`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function redeploy() {
    try {
      const r = await fetch("/api/deploy/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          provider: "netlify",
          previewPath: `/previews/${jobId}/`,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "enqueue failed");
      toast({ title: "Queued new deploy" });
      window.dispatchEvent(new CustomEvent("workspace:show-build"));
    } catch (e: any) {
      toast({
        title: "Could not queue deploy",
        description: e?.message || "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function cancelDeploy() {
    try {
      const r = await fetch("/api/deploy/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ clientRoom: jobId }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "cancel failed");
      toast({ title: "Cancelling…" });
    } catch (e: any) {
      toast({
        title: "Could not cancel",
        description: e?.message || "Unknown error",
        variant: "destructive",
      });
    }
  }

  function sendChat() {
    const text = draft.trim();
    if (!text) return;
    const s = getSocket();
    s.emit("deploy:chat", { jobId, text, user: "you" });
    // optimistic update
    setChat((prev) => [...prev, { user: "you", text, ts: Date.now() }]);
    setDraft("");
  }

  // classify a log line for color
  function lineClass(line: string) {
    const s = line.toLowerCase();
    if (s.includes("error") || s.includes("failed")) return "text-red-600";
    if (s.includes("warn")) return "text-amber-600";
    if (s.includes("deployed") || s.includes("success")) return "text-green-600";
    return "text-muted-foreground";
  }

  // escape basic HTML
  function escapeHtml(str: string) {
    return str.replaceAll(/&/g, "&amp;").replaceAll(/</g, "&lt;").replaceAll(/>/g, "&gt;");
  }

  // simple linkify (Netlify/Admin URLs, http(s) generally)
  function linkify(line: string) {
    const safe = escapeHtml(line);
    const urlRe =
      /(https?:\/\/[^\s)]+)|(app\.netlify\.com\/[^\s)]+)|(\b[\w-]+\.netlify\.app[^\s)]*)/gi;
    return safe.replace(urlRe, (m) => {
      const href = m.startsWith("http") ? m : `https://${m}`;
      return `<a href="${href}" target="_blank" rel="noreferrer">${m}</a>`;
    });
  }

  return (
    <div className="border rounded bg-background">
      <div className="px-3 py-2 text-xs border-b flex items-center gap-2">
        <div className="font-medium">Deploy</div>
        <div className="text-muted-foreground">• {stage}</div>
        {stage !== "idle" && stage !== "done" && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            ● LIVE
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={downloadLogs}>
            Download logs
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={cancelDeploy}
            disabled={stage === "idle" || stage === "done"}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={redeploy}>
            Redeploy
          </Button>
          <Button size="sm" variant="outline" onClick={copyAll}>
            Copy logs
          </Button>
          {url && (
            <a className="text-xs underline" href={url} target="_blank" rel="noreferrer">
              Open
            </a>
          )}
          {adminUrl && (
            <a className="text-xs underline" href={adminUrl} target="_blank" rel="noreferrer">
              Netlify
            </a>
          )}
        </div>
      </div>

      <div
        ref={boxRef}
        className="p-3 text-xs font-mono h-48 overflow-auto whitespace-pre-wrap leading-relaxed space-y-1"
      >
        {lines.length ? (
          lines.map((ln, i) => (
            <div
              key={i}
              className={lineClass(ln)}
              dangerouslySetInnerHTML={{ __html: linkify(ln) }}
            />
          ))
        ) : (
          "Waiting for deploy logs…"
        )}
      </div>

      {/* lightweight chat box */}
      <div className="border-t grid grid-rows-[1fr_auto] h-40">
        <div className="p-3 overflow-auto">
          {chat.length === 0 ? (
            <div className="text-xs text-muted-foreground">Chat about this build…</div>
          ) : (
            chat.map((m, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium">{m.user}:</span> {m.text}
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
              if (e.key === "Enter") sendChat();
            }}
          />
          <Button size="sm" onClick={sendChat}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
