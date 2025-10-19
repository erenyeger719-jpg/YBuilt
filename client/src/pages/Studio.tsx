// client/src/pages/Studio.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Sparkles, Upload, Palette, Server, ShieldCheck } from "lucide-react";

type Job = { id: string; status?: string; title?: string; prompt?: string };
type DeployPreset = "beginner" | "pro" | "business" | "custom";
type ThemeDef = { id: string; name: string; colors: [string, string, string] };

const PRESET_THEMES: ThemeDef[] = [
  { id: "mono", name: "Monochrome", colors: ["#000000", "#7A7A7A", "#FFFFFF"] },
  { id: "sunset", name: "Sunset Glow", colors: ["#0a0a0a", "#ff4da6", "#ffffff"] },
  { id: "royal", name: "Royal", colors: ["#0b0b0b", "#7A1FF3", "#E8DDFF"] },
  { id: "slate", name: "Slate Sky", colors: ["#0b0b0b", "#3B82F6", "#DBEAFE"] },
];

/** Studio-only FX with event delegation: scroll stops, magnetic, tilt, reveal */
function useStudioFX() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".studio-root");
    if (!root) return;

    // --- Scroll-scrub stops (rAF-throttled)
    let scrollRAF = 0;
    const onScroll = () => {
      if (scrollRAF) return;
      scrollRAF = requestAnimationFrame(() => {
        scrollRAF = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight || 1;
        const p = Math.min(1, Math.max(0, window.scrollY / max));
        root.style.setProperty("--scroll", p.toFixed(3));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // init

    // --- Event-delegated magnetic buttons & tilt cards
    let lastMag: HTMLElement | null = null;
    let lastTilt: HTMLElement | null = null;

    const onPointerMoveDelegated = (e: PointerEvent) => {
      // Magnetic button under cursor?
      const mag = (e.target as HTMLElement)?.closest<HTMLElement>(".btn-magnetic");
      if (mag) {
        lastMag = mag;
        const b = mag.getBoundingClientRect();
        const x = e.clientX - (b.left + b.width / 2);
        const y = e.clientY - (b.top + b.height / 2);
        const clamp = (v: number) => Math.max(-24, Math.min(24, v));
        mag.style.setProperty("--tx", clamp(x * 0.15) + "px");
        mag.style.setProperty("--ty", clamp(y * 0.15) + "px");
      } else if (lastMag) {
        // leave
        lastMag.style.setProperty("--tx", "0px");
        lastMag.style.setProperty("--ty", "0px");
        lastMag = null;
      }

      // Tilt card under cursor?
      const tilt = (e.target as HTMLElement)?.closest<HTMLElement>(".card-tilt");
      if (tilt) {
        lastTilt = tilt;
        const r = tilt.getBoundingClientRect();
        const px = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
        const py = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
        tilt.style.setProperty("--ry", (px * 7) + "deg");
        tilt.style.setProperty("--rx", (-py * 7) + "deg");
      } else if (lastTilt) {
        lastTilt.style.removeProperty("--rx");
        lastTilt.style.removeProperty("--ry");
        lastTilt = null;
      }
    };

    const onPointerLeaveRoot = () => {
      if (lastMag) {
        lastMag.style.setProperty("--tx", "0px");
        lastMag.style.setProperty("--ty", "0px");
        lastMag = null;
      }
      if (lastTilt) {
        lastTilt.style.removeProperty("--rx");
        lastTilt.style.removeProperty("--ry");
        lastTilt = null;
      }
    };

    root.addEventListener("pointermove", onPointerMoveDelegated, { passive: true });
    root.addEventListener("pointerleave", onPointerLeaveRoot, { passive: true });

    // --- Diagonal text reveal (fire early so things don’t look “missing”)
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.01 }
    );
    const reveals = Array.from(root.querySelectorAll<HTMLElement>(".reveal-diag"));
    reveals.forEach((n) => io.observe(n));

    return () => {
      window.removeEventListener("scroll", onScroll);
      root.removeEventListener("pointermove", onPointerMoveDelegated);
      root.removeEventListener("pointerleave", onPointerLeaveRoot);
      io.disconnect();
      cancelAnimationFrame(scrollRAF);
    };
  }, []);
}

/** Mount/unmount: toggle the Studio forced theme on <body> */
function useForceStudioTheme(enable: boolean) {
  useEffect(() => {
    if (enable) {
      document.body.dataset.forceTheme = "studio";
    } else {
      delete document.body.dataset.forceTheme;
    }
    return () => {
      delete document.body.dataset.forceTheme;
    };
  }, [enable]);
}

export default function StudioPage() {
  const { jobId } = useParams<{ jobId?: string }>();

  // Marketing view (no :jobId)
  if (!jobId) {
    useForceStudioTheme(true);
    useStudioFX();
    return (
      <section className="studio-root min-h-screen">
        <div className="relative z-10">
          <Header />
        </div>

        <header className="relative z-10 max-w-6xl mx-auto pt-20 px-6 text-center">
          <p className="h-tagline reveal-diag">BUILD FASTER</p>
          <h1 className="h-display reveal-diag mt-2" style={{ letterSpacing: "-0.02em" }}>
            Inside a living canvas
          </h1>

          <div className="mt-8 flex justify-center gap-3">
            <Button className="btn btn-magnetic card-glass px-6 py-3 rounded-xl">Start building</Button>
            <Button variant="secondary" className="btn btn-magnetic px-6 py-3 rounded-xl border">Watch demo</Button>
          </div>
        </header>

        <div className="relative z-10">
          <Hero />
          <div className="max-w-7xl mx-auto px-6 content-auto">
            <Showcase />
          </div>
        </div>
      </section>
    );
  }

  // Finalize view (with :jobId)
  return <FinalizeStudio jobId={jobId} />;
}

function FinalizeStudio({ jobId }: { jobId: string }) {
  useForceStudioTheme(true);
  useStudioFX();

  const { toast } = useToast();

  // Job + initial prompt
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  // Left panel state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Deployment (defaults to beginner / low cost)
  const [deployPreset, setDeployPreset] = useState<DeployPreset>("beginner");
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [customPlatform, setCustomPlatform] = useState("Render");
  const [customHost, setCustomHost] = useState("render.com");

  // Themes
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeDef>(PRESET_THEMES[1]); // sunset default
  const [customA, setCustomA] = useState("#0a0a0a");
  const [customB, setCustomB] = useState("#ff4da6");
  const [customC, setCustomC] = useState("#ffffff");

  // Middle “plan” text
  const lastPrompt = useMemo(() => localStorage.getItem("lastPrompt") || "", []);
  const plan = useMemo(() => {
    const base = job?.prompt || lastPrompt || "New project";
    const tier =
      deployPreset === "beginner" ? "Starter stack (cheap hosting, simple CI)"
        : deployPreset === "pro" ? "Pro stack (Git + CI, observability, CDN)"
          : deployPreset === "business" ? "Business-ready (teams, SSO, tracing)"
            : "Custom deployment";

    return {
      name: (base || "Project").slice(0, 60),
      summary: `Plan based on your idea: “${base}”.`,
      stack: tier,
    };
  }, [job?.prompt, lastPrompt, deployPreset]);

  // Load job (for title/prompt)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}`, { credentials: "include" });
        const data = r.ok ? await r.json() : null;
        if (alive) setJob(data || null);
      } catch {
        // ignore
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [jobId]);

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
      toast({ title: "Upload failed", description: err?.message || "Request failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function saveToLibrary() {
    try {
      await fetch("/api/drafts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          userId: "demo",
          plan,
          theme: selectedTheme,
          deployPreset,
        }),
      });
      toast({ title: "Saved", description: "Draft saved to your library." });
      window.location.assign("/library");
    } catch (err: any) {
      toast({ title: "Couldn’t save", description: err?.message || "Request failed", variant: "destructive" });
    }
  }

  async function openWorkspace() {
    try {
      await fetch(`/api/jobs/${jobId}/select`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "studio",
          theme: selectedTheme,
          deployPreset,
        }),
      }).catch(() => {});
    } finally {
      const target = `/workspace/${jobId}`;
      window.location.assign(target);
      setTimeout(() => (window.location.href = target), 40);
    }
  }

  if (loading) {
    return (
      <div className="studio-root min-h-screen grid place-items-center">
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Preparing studio…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-root min-h-screen">
      {/* Keep your header on top of the glass */}
      <div className="relative z-10">
        <Header />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* 3-column premium layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT — inputs & choices */}
          <Card className="lg:col-span-4 p-6 card-glass card-tilt">
            <div className="gloss-sheen" />
            <div className="relative z-10 space-y-6">
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Finalize inputs
              </h2>

              {/* Deployment method */}
              <div className="space-y-2">
                <Label>Send to Internet</Label>
                <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full justify-between">
                      {deployPreset === "beginner" && "Beginner (low cost) — default"}
                      {deployPreset === "pro" && "Professional (medium)"}
                      {deployPreset === "business" && "Business"}
                      {deployPreset === "custom" && `Custom: ${customPlatform}`}
                      <Server className="h-4 w-4 opacity-75" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Select deployment method</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      <PresetCard
                        title="Beginner"
                        desc="Very low cost, simple hosting"
                        active={deployPreset === "beginner"}
                        onClick={() => setDeployPreset("beginner")}
                      />
                      <PresetCard
                        title="Professional"
                        desc="Git repo + CI, monitoring"
                        active={deployPreset === "pro"}
                        onClick={() => setDeployPreset("pro")}
                      />
                      <PresetCard
                        title="Business"
                        desc="Teams, SSO, advanced tracing"
                        active={deployPreset === "business"}
                        onClick={() => setDeployPreset("business")}
                      />
                      <PresetCard
                        title="Select your own"
                        desc="Choose platform + host"
                        active={deployPreset === "custom"}
                        onClick={() => setDeployPreset("custom")}
                      />
                    </div>

                    {deployPreset === "custom" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        <div>
                          <Label>Platform</Label>
                          <Select value={customPlatform} onValueChange={setCustomPlatform}>
                            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Render">Render</SelectItem>
                              <SelectItem value="Vercel">Vercel</SelectItem>
                              <SelectItem value="Netlify">Netlify</SelectItem>
                              <SelectItem value="Fly.io">Fly.io</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Host (notes)</Label>
                          <Input className="mt-1.5" value={customHost} onChange={(e) => setCustomHost(e.target.value)} />
                        </div>
                      </div>
                    )}

                    <DialogFooter className="mt-4">
                      <Button onClick={() => setDeployDialogOpen(false)}>Done</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <p className="text-xs text-muted-foreground">
                  API keys and URLs will be collected inside the Workspace.
                </p>
              </div>

              {/* Upload inspirations */}
              <div className="space-y-2">
                <Label>Upload inspiration</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    disabled={uploading}
                  />
                  <Button onClick={uploadInspiration} disabled={!file || uploading} className="gap-1">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading…" : "Upload"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  JPEG/PNG/SVG or text docs. You can add more later.
                </p>
              </div>

              {/* Themes */}
              <div className="space-y-2">
                <Label>Theme</Label>
                <Sheet open={themeSheetOpen} onOpenChange={setThemeSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="secondary" className="w-full justify-between">
                      {selectedTheme.name}
                      <Palette className="h-4 w-4 opacity-75" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Select a theme</SheetTitle>
                    </SheetHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      {PRESET_THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setSelectedTheme(t); }}
                          className={`p-3 rounded-lg border text-left hover-elevate ${selectedTheme.id === t.id ? "ring-2 ring-primary" : ""}`}
                        >
                          <div className="font-medium mb-2">{t.name}</div>
                          <ThemeBar colors={t.colors} />
                        </button>
                      ))}
                    </div>

                    <div className="mt-6 border-t pt-4 space-y-3">
                      <div className="font-medium">Add your own</div>
                      <div className="grid grid-cols-3 gap-3">
                        <input type="color" value={customA} onChange={(e) => setCustomA(e.target.value)} className="h-10 w-full rounded" />
                        <input type="color" value={customB} onChange={(e) => setCustomB(e.target.value)} className="h-10 w-full rounded" />
                        <input type="color" value={customC} onChange={(e) => setCustomC(e.target.value)} className="h-10 w-full rounded" />
                      </div>
                      <div className="flex items-center justify-between">
                        <ThemeBar colors={[customA, customB, customC]} />
                        <Button
                          onClick={() => {
                            setSelectedTheme({ id: "custom", name: "Custom", colors: [customA, customB, customC] });
                            setThemeSheetOpen(false);
                          }}
                          className="ml-3"
                        >
                          Save theme
                        </Button>
                      </div>
                    </div>

                    <SheetFooter className="mt-4">
                      <Button variant="outline" onClick={() => setThemeSheetOpen(false)}>Close</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                {/* Live preview chip under the button */}
                <ThemeBar colors={selectedTheme.colors} className="mt-2" />
              </div>
            </div>
          </Card>

          {/* MIDDLE — plan + prompt */}
          <Card className="lg:col-span-5 p-6 card-glass card-tilt">
            <div className="gloss-sheen" />
            <div className="relative z-10 space-y-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <h2 className="text-xl font-semibold">AI plan</h2>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Project name</div>
                <div className="text-2xl font-semibold metal-text reveal-diag">{plan.name || "Your project"}</div>

                <div className="mt-4 text-sm reveal-diag">
                  <div className="text-muted-foreground mb-1">Summary</div>
                  <p>{plan.summary}</p>
                </div>

                <div className="mt-4 text-sm reveal-diag">
                  <div className="text-muted-foreground mb-1">Stack</div>
                  <p>{plan.stack}</p>
                </div>
              </div>

              {/* Prompt (read-only carryover) */}
              <div className="mt-6">
                <Label className="text-sm">Prompt</Label>
                <Input
                  value={job?.prompt || lastPrompt}
                  readOnly
                  className="mt-1.5 bg-background/50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This came from the Home prompt. You can refine inside the Workspace.
                </p>
              </div>
            </div>
          </Card>

          {/* RIGHT — actions */}
          <Card className="lg:col-span-3 p-6 card-glass card-tilt">
            <div className="gloss-sheen" />
            <div className="relative z-10 space-y-4">
              <h2 className="text-xl font-semibold">Actions</h2>
              <Button onClick={openWorkspace} className="w-full btn btn-magnetic">
                Finalize & Open Workspace
              </Button>
              <Button onClick={saveToLibrary} variant="secondary" className="w-full btn btn-magnetic">
                Save to Library
              </Button>

              <div className="mt-3 text-xs text-muted-foreground">
                Job <span className="font-mono">{jobId}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ThemeBar({ colors, className = "" }: { colors: [string, string, string] | string[]; className?: string }) {
  const [c1, c2, c3] = colors as string[];
  return (
    <div
      className={`rounded-md overflow-hidden border ${className}`}
      style={{ background: `linear-gradient(90deg, ${c1} 0 33%, ${c2} 33% 66%, ${c3} 66% 100%)`, height: 28 }}
    />
  );
}

function PresetCard({ title, desc, active, onClick }: { title: string; desc: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border text-left hover-elevate ${active ? "ring-2 ring-primary" : ""}`}
    >
      <div className="font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
