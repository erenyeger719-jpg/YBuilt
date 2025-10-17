// client/src/pages/Studio.tsx
import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// --- marketing bits you already had ---
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";

type Job = { id: string; status?: string; title?: string; prompt?: string };

export default function Studio() {
  // NOTE: jobId is optional; page serves both /studio and /studio/:jobId
  const { jobId } = useParams<{ jobId?: string }>();

  // If no id → render your existing marketing Studio page
  if (!jobId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <Hero />
        <Showcase />
      </div>
    );
  }

  // If id exists → render the finalize-only strip (no marketing UI)
  return <FinalizeStudio jobId={jobId} />;
}

function FinalizeStudio({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}`, { credentials: "include" });
        const data = r.ok ? await r.json() : null;
        if (alive) setJob(data || null);
      } catch {/* ignore */}
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [jobId]);

  async function openWorkspace() {
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
    if (!file) return;
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Preparing studio…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-3xl space-y-6">
        <Card className="p-6 relative z-50"> {/* sits above anything else */}
          <h1 className="text-xl font-semibold mb-1">Finalize your project</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Job <span className="font-mono">{jobId}</span>
            {job?.title ? <> — <span className="font-medium">{job.title}</span></> : null}
          </p>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload inspiration (optional)</label>
              <div className="flex gap-2">
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={uploading || finalizing} />
                <Button onClick={uploadInspiration} disabled={!file || uploading || finalizing}>
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                JPEG/PNG/SVG or text docs work fine. You can add more later inside the workspace.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={openWorkspace} disabled={finalizing}>
                {finalizing ? "Opening…" : "Finalize & Open Workspace"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const target = `/workspace/${jobId}`;
                  window.location.assign(target);
                  setTimeout(() => (window.location.href = target), 40);
                }}
                disabled={finalizing}
              >
                Skip for now
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
