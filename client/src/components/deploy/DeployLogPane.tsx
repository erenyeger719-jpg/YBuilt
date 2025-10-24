import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";

export default function DeployLogPane({ jobId }: { jobId: string }){
  const [lines, setLines] = useState<string[]>([]);
  const [stage, setStage] = useState<string>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    if(!jobId) return;
    const s = getSocket();
    s.emit("deploy:join", { jobId });

    const onEvt = (p: any) => {
      if(p?.type === "log") setLines(prev => [...prev, p.line]);
      if(p?.type === "stage") setStage(p.stage || "");
      if(p?.type === "done"){
        setStage("done");
        if(p.url) setUrl(p.url);
      }
      // autoscroll
      requestAnimationFrame(()=>{
        const el = boxRef.current; if(!el) return;
        el.scrollTop = el.scrollHeight;
      });
    };
    s.on("deploy:event", onEvt);

    return () => {
      s.emit("deploy:leave", { jobId });
      s.off("deploy:event", onEvt);
    };
  }, [jobId]);

  function copyAll(){
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).catch(()=>{});
  }

  return (
    <div className="border rounded bg-background">
      <div className="px-3 py-2 text-xs border-b flex items-center gap-2">
        <div className="font-medium">Deploy</div>
        <div className="text-muted-foreground">• {stage}</div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={copyAll}>Copy logs</Button>
          {url && <a className="text-xs underline" href={url} target="_blank" rel="noreferrer">Open</a>}
        </div>
      </div>
      <div ref={boxRef} className="p-3 text-xs font-mono h-48 overflow-auto whitespace-pre-wrap leading-relaxed">
        {lines.length ? lines.join("\n") : "Waiting for deploy logs…"}
      </div>
    </div>
  );
}
