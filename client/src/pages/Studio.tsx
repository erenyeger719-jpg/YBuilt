import { useState, useEffect } from "react";
import { useParams } from "wouter";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";
import ChatPanel from "@/components/ChatPanel";
import TerminalPanel from "@/components/TerminalPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, X, Code2 } from "lucide-react";

type Job = { id: string; status?: string; title?: string; prompt?: string };

export default function Studio() {
  const { jobId } = useParams<{ jobId?: string }>();
  const { toast } = useToast();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // finalize helpers
  const [loadingJob, setLoadingJob] = useState<boolean>(!!jobId);
  const [job, setJob] = useState<Job | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}`, { credentials: "include" });
        const data = r.ok ? await r.json() : null;
        if (alive) setJob(data || null);
      } catch { /* ignore */ }
      finally { if (alive) setLoadingJob(false); }
    })();
    return () => { alive = false; };
  }, [jobId]);

  async function openWorkspace() {
    if (!jobId) return;
    try {
      setFinalizing(true);
      const r = await fetch(`/api/jobs/${jobId}/select`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "studio" }),
      });
      if (!r.ok) throw new Error((await r.text()) || r.statusText);
      const target = `/workspace/${jobId}`;
      window.location.assign(target);
      setTimeout(() => (window.location.href = target), 40);
    } catch (err: any) {
      toast({
        title: "Couldn’t open workspace",
        description: err?.message || "Request failed",
        variant: "destructive",
      });
      setFinalizing(false);
    }
  }

  async function uploadInspiration() {
    if (!jobId || !file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/workspace/${jobId}/upload`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!r.ok) throw new Error((await r.text()) || r.statusText);
      toast({ title: "Uploaded", description: `${file.name} added to workspace` });
      setFile(null);
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message || "Request failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Finalize strip (only when :jobId present) */}
      {jobId && (
        <div className="container mx-auto px-4 pt-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Finalize your project</h2>
                <p className="text-sm text-muted-foreground">
                  Job <span className="font-mono">{jobId}</span>
                  {loadingJob ? " — loading…" : job?.title ? <> — <span className="font-medium">{job.title}</span></> : null}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={uploading || finalizing}
                />
                <Button onClick={uploadInspiration} disabled={!file || uploading || finalizing}>
                  {uploading ? "Uploading…" : "Upload inspiration"}
                </Button>
                <Button onClick={openWorkspace} disabled={finalizing}>
                  {finalizing ? "Opening…" : "Finalize & Open Workspace"}
                </Button>
                <Button
                  variant="outline"
                  disabled={finalizing}
                  onClick={() => {
                    const target = `/workspace/${jobId}`;
                    window.location.assign(target);
                    setTimeout(() => (window.location.href = target), 40);
                  }}
                >
                  Skip
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* original landing content */}
      <Hero />
      <Showcase />

      {/* Terminal Toggle */}
      <Button
        size="icon"
        className="fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => setIsTerminalOpen(!isTerminalOpen)}
        data-testid="button-toggle-terminal"
      >
        {isTerminalOpen ? <X className="w-6 h-6" /> : <Code2 className="w-6 h-6" />}
      </Button>

      {/* Chat Toggle */}
      <Button
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => setIsChatOpen(!isChatOpen)}
        data-testid="button-toggle-chat"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>

      {/* Panels */}
      {isTerminalOpen && (
        <div className="fixed bottom-24 left-6 w-[600px] h-[700px] z-40 shadow-2xl" data-testid="terminal-panel-container">
          <TerminalPanel />
        </div>
      )}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-[400px] h-[600px] z-40 shadow-2xl" data-testid="chat-panel-container">
          <ChatPanel />
        </div>
      )}
    </div>
  );
}
