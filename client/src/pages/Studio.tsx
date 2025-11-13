// client/src/pages/Studio.tsx
import {
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Showcase from "@/components/Showcase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Upload,
  Palette,
  Server,
  ShieldCheck,
  Check,
  ChevronRight,
  Edit2,
  Info,
} from "lucide-react";
import { aiScaffold } from "@/lib/aiActions";

type Job = { id: string; status?: string; title?: string; prompt?: string };
type DeployPreset = "beginner" | "pro" | "business" | "custom";
type ThemeDef = { id: string; name: string; colors: [string, string, string] };

// --- Brand-aligned Studio themes (match hero & prompt bar) ---
const PRESET_THEMES: ThemeDef[] = [
  {
    id: "hero-horizon",
    name: "Hero Horizon",
    colors: ["#171717", "#587CC9", "#F16D0B"], // charcoal → steel blue → sunset orange
  },
  {
    id: "prompt-neon",
    name: "Prompt Neon",
    colors: ["#0B0B0B", "#C26BFF", "#F28AC1"], // deep black → violet → soft pink
  },
  {
    id: "midnight-lilac",
    name: "Midnight Lilac",
    colors: ["#050814", "#283854", "#C89EE1"], // near-black → midnight blue → lilac
  },
  {
    id: "slate-ember",
    name: "Slate Ember",
    colors: ["#0B0B0B", "#4262A3", "#F27166"], // black → slate blue → warm coral
  },
  {
    id: "cinematic-mono",
    name: "Cinematic Mono",
    colors: ["#000000", "#4B5563", "#F9FAFB"], // black → slate gray → soft white
  },
  {
    id: "rose-glass",
    name: "Rose Glass",
    colors: ["#090909", "#F273BF", "#FFEAF7"], // black → rose → light rose
  },
];

const DEPLOY_DESCRIPTIONS = {
  beginner: "Single click deploy, lowest cost. Good for first launches.",
  pro: "Git + CI + monitoring. For serious projects.",
  business: "Teams, SSO, and audits.",
  custom: "We'll ask for your provider details inside the Workspace.",
} as const;

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
        const max =
          document.documentElement.scrollHeight - window.innerHeight || 1;
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
      const mag = (e.target as HTMLElement)?.closest<HTMLElement>(
        ".btn-magnetic",
      );
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
        tilt.style.setProperty("--ry", px * 7 + "deg");
        tilt.style.setProperty("--rx", -py * 7 + "deg");
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

    root.addEventListener("pointermove", onPointerMoveDelegated, {
      passive: true,
    });
    root.addEventListener("pointerleave", onPointerLeaveRoot, {
      passive: true,
    });

    // --- Diagonal text reveal (fire early so things don't look "missing")
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.01 },
    );
    const reveals = Array.from(
      root.querySelectorAll<HTMLElement>(".reveal-diag"),
    );
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
      (document.body as any).dataset.forceTheme = "studio";
    } else {
      delete (document.body as any).dataset.forceTheme;
    }
    return () => {
      delete (document.body as any).dataset.forceTheme;
    };
  }, [enable]);
}

export default function StudioPage() {
  const { jobId } = useParams<{ jobId?: string }>();
  const { toast } = useToast();

  // Autorun AI build (from Templates → Studio)
  const [busy, setBusy] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [autoRan, setAutoRan] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tierDefault =
    (localStorage.getItem("ybuilt.aiTier") as any) || "balanced";

  useEffect(() => {
    if (autoRan) return;
    const raw = localStorage.getItem("ybuilt.studio.autorun");
    if (!raw) return;

    setAutoRan(true);
    localStorage.removeItem("ybuilt.studio.autorun");

    let payload: any = null;
    try {
      payload = JSON.parse(raw);
    } catch {}
    if (!payload?.prompt) return;

    (async () => {
      setBusy(true);
      setErr(null);
      try {
        const { prompt, blocks, tier } = payload;
        const { path } = await aiScaffold({
          prompt,
          blocks: Array.isArray(blocks) ? blocks : [],
          tier: tier || tierDefault,
        } as any);
        setResultPath(path);
        toast({ title: "Generated", description: payload.name || "Template" });
      } catch (e: any) {
        setErr(e?.message || "Generation failed");
      } finally {
        setBusy(false);
      }
    })();
  }, [autoRan, tierDefault, toast]);

  // helper for links
  const openOrNavigate = (u: string) => {
    const w = window.open(u, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = u;
  };

  // Marketing view (no :jobId)
  if (!jobId) {
    useForceStudioTheme(true);
    useStudioFX();
    return (
      <section
        className="studio-root min-h-screen text-white relative overflow-hidden"
        style={{
          background: `
            linear-gradient(
              180deg,
              #171717 0%,
              #171717 33%,
              #191919 38%,
              #1A1D22 43%,
              #242F40 48%,
              #283854 53%,
              #4262A3 58%,
              #587CC9 63%,
              #698AD5 68%,
              #8B97DE 73%,
              #C89EE1 78%,
              #D499D9 83%,
              #F27166 88%,
              #F27361 92%,
              #F16E3C 96%,
              #F16D0B 100%
            )
          `,
        }}
      >
        <div className="relative z-10">
          <Header />
        </div>

        <header className="relative z-10 max-w-6xl mx-auto pt-20 px-6 text-center">
          <p className="h-tagline reveal-diag">BUILD FASTER</p>
          <h1
            className="h-display reveal-diag mt-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            Inside a living canvas
          </h1>

          <div className="mt-8 flex justify-center gap-3">
            <Button className="btn btn-magnetic px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20">
              Start building
            </Button>
            <Button
              variant="secondary"
              className="btn btn-magnetic px-6 py-3 rounded-xl border"
            >
              Watch demo
            </Button>
          </div>

          {/* Autorun status/CTAs */}
          {busy && (
            <div className="mt-6 mx-auto max-w-2xl rounded-lg border border-white/20 bg-black/40 p-4 text-white/80">
              Building from template…
            </div>
          )}

          {err && (
            <div className="mt-6 mx-auto max-w-2xl rounded-lg border border-red-400/30 bg-red-900/30 p-4 text-red-200">
              {err}
            </div>
          )}

          {!busy && resultPath && (
            <div className="mt-6 mx-auto max-w-2xl rounded-lg border border-white/20 bg-black/50 p-4 text-white">
              <div className="text-sm mb-2">Preview ready:</div>
              <a
                className="text-xs underline break-all text-blue-300"
                href={resultPath}
                target="_blank"
                rel="noreferrer"
              >
                {resultPath}
              </a>
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                <button
                  className="px-3 py-1.5 text-sm rounded border border-white/20 hover:bg-white/10"
                  onClick={() => openOrNavigate(resultPath!)}
                >
                  Open preview
                </button>
                <button
                  className="px-3 py-1.5 text-sm rounded border border-white/20 hover:bg-white/10"
                  onClick={() => {
                    localStorage.setItem(
                      "ybuilt.quickedit.autoOpen",
                      JSON.stringify({ path: resultPath, file: "index.html" }),
                    );
                    window.location.assign("/library?open=1"); // "Open in workspace"
                  }}
                >
                  Open in workspace
                </button>
                <a
                  href="/templates"
                  className="px-3 py-1.5 text-sm rounded border border-white/20 hover:bg-white/10"
                >
                  Try another template
                </a>
              </div>
            </div>
          )}
        </header>

        {/* Only Showcase, no Hero (so no second background) */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24">
          <Showcase />
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Job + initial prompt
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  // Left panel state
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Deployment (defaults to beginner / low cost)
  const [deployPreset, setDeployPreset] = useState<DeployPreset>("beginner");
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [customPlatform, setCustomPlatform] = useState("Render");
  const [customHost, setCustomHost] = useState("render.com");

  // Themes
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeDef>(
    PRESET_THEMES[0], // Hero Horizon default
  );
  const [customA, setCustomA] = useState("#0a0a0a");
  const [customB, setCustomB] = useState("#ff4da6");
  const [customC, setCustomC] = useState("#ffffff");

  // Middle "plan" - now editable
  const lastPrompt = useMemo(
    () => localStorage.getItem("lastPrompt") || "",
    [],
  );
  const [projectName, setProjectName] = useState("");
  const [projectSummary, setProjectSummary] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [editablePrompt, setEditablePrompt] = useState("");
  const [showTechInfo, setShowTechInfo] = useState(false);

  // Initialize editable fields
  useEffect(() => {
    const initialPrompt = job?.prompt || lastPrompt || "New project";
    setProjectName((initialPrompt || "Project").slice(0, 60));
    setProjectSummary(`Plan based on your idea: "${initialPrompt}".`);
    setEditablePrompt(initialPrompt);
  }, [job?.prompt, lastPrompt]);

  // Load job (for title/prompt)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}`, {
          credentials: "include",
        });
        const data = r.ok ? await r.json() : null;
        if (alive) setJob(data || null);
      } catch {
        // ignore
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [jobId]);

  // Auto-upload on file selection
  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = e.target.files?.[0];
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

      setUploadedFiles((prev) => [...prev, file.name]);
      toast({
        title: "Uploaded",
        description: `${file.name} added to workspace`,
      });

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  async function saveToLibrary() {
    try {
      await fetch("/api/drafts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          userId: "demo",
          plan: {
            name: projectName,
            summary: projectSummary,
            prompt: editablePrompt,
          },
          theme: selectedTheme,
          deployPreset,
        }),
      });
      toast({ title: "Saved", description: "Draft saved to your library." });
      window.location.assign("/library");
    } catch (err: any) {
      toast({
        title: "Couldn't save",
        description: err?.message || "Request failed",
        variant: "destructive",
      });
    }
  }

  async function openWorkspace() {
    // Save editable fields before opening
    localStorage.setItem("lastPrompt", editablePrompt);

    try {
      await fetch(`/api/jobs/${jobId}/select`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "studio",
          theme: selectedTheme,
          deployPreset,
          projectName,
          prompt: editablePrompt,
        }),
      }).catch(() => {});
    } finally {
      const target = `/workspace/${jobId}`;
      window.location.assign(target);
      setTimeout(() => (window.location.href = target), 40);
    }
  }

  // Check if ready to launch
  const isReady = !!(deployPreset && selectedTheme && editablePrompt);

  if (loading) {
    return (
      <div
        className="studio-root min-h-screen grid place-items-center text-white relative overflow-hidden"
        style={{
          background: `
            linear-gradient(
              180deg,
              #171717 0%,
              #171717 33%,
              #191919 38%,
              #1A1D22 43%,
              #242F40 48%,
              #283854 53%,
              #4262A3 58%,
              #587CC9 63%,
              #698AD5 68%,
              #8B97DE 73%,
              #C89EE1 78%,
              #D499D9 83%,
              #F27166 88%,
              #F27361 92%,
              #F16E3C 96%,
              #F16D0B 100%
            )
          `,
        }}
      >
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Preparing studio…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="studio-root min-h-screen text-white relative overflow-hidden"
      style={{
        background: `
          linear-gradient(
            180deg,
            #171717 0%,
            #171717 33%,
            #191919 38%,
            #1A1D22 43%,
            #242F40 48%,
            #283854 53%,
            #4262A3 58%,
            #587CC9 63%,
            #698AD5 68%,
            #8B97DE 73%,
            #C89EE1 78%,
            #D499D9 83%,
            #F27166 88%,
            #F27361 92%,
            #F16E3C 96%,
            #F16D0B 100%
          )
        `,
      }}
    >
      {/* Keep your header on top of the glass */}
      <div className="relative z-10">
        <Header />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* Step indicator */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary">
              1. Describe
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-medium">
              2. Review
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="px-2 py-1 rounded-full bg-muted">3. Build</span>
          </div>
          <h1 className="text-3xl font-bold mt-3">
            Step 2 · Review your build plan
          </h1>
          <p className="text-muted-foreground mt-2">
            We'll open the Workspace next. Just check these details once.
          </p>
        </div>

        {/* 3-column premium layout with aligned heights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT — inputs & choices */}
          <Card className="lg:col-span-3 p-6 h-full bg-black/20 backdrop-blur-sm border-white/10">
            <div className="relative z-10 space-y-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Configuration
              </h2>

              {/* Deployment method - friendlier label */}
              <div className="space-y-2">
                <Label>How advanced should this setup be?</Label>
                <Dialog
                  open={deployDialogOpen}
                  onOpenChange={setDeployDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="secondary"
                      className="w-full justify-between text-left"
                    >
                      <span className="truncate">
                        {deployPreset === "beginner" && "Beginner"}
                        {deployPreset === "pro" && "Professional"}
                        {deployPreset === "business" && "Business"}
                        {deployPreset === "custom" && "Custom"}
                      </span>
                      <Server className="h-4 w-4 opacity-75 flex-shrink-0" />
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
                          <Select
                            value={customPlatform}
                            onValueChange={setCustomPlatform}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
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
                          <Input
                            className="mt-1.5"
                            value={customHost}
                            onChange={(e) => setCustomHost(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <DialogFooter className="mt-4">
                      <Button onClick={() => setDeployDialogOpen(false)}>
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <p className="text-xs text-muted-foreground italic">
                  {DEPLOY_DESCRIPTIONS[deployPreset]}
                </p>
              </div>

              {/* Upload inspirations - instant upload */}
              <div className="space-y-2">
                <Label>Upload inspiration</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  variant="secondary"
                  className="w-full justify-start gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading
                    ? "Uploading…"
                    : uploadedFiles.length > 0
                      ? `${uploadedFiles.length} file(s) uploaded`
                      : "Choose files"}
                </Button>
                {uploadedFiles.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-500" />
                      Last added: {uploadedFiles[uploadedFiles.length - 1]}
                    </div>
                    {uploadedFiles.length > 1 && (
                      <div className="text-muted-foreground/70">
                        +{uploadedFiles.length - 1} more…
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Themes */}
              <div className="space-y-2">
                <Label>Theme</Label>
                <Sheet open={themeSheetOpen} onOpenChange={setThemeSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                    >
                      {selectedTheme.name}
                      <Palette className="h-4 w-4 opacity-75" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="max-h-[70vh] overflow-y-auto"
                  >
                    <SheetHeader>
                      <SheetTitle>Select a theme</SheetTitle>
                    </SheetHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      {PRESET_THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setSelectedTheme(t);
                          }}
                          className={`p-3 rounded-lg border text-left hover-elevate ${
                            selectedTheme.id === t.id
                              ? "ring-2 ring-primary"
                              : ""
                          }`}
                        >
                          <div className="font-medium mb-2">{t.name}</div>
                          <ThemeBar colors={t.colors} />
                          {t.id === "hero-horizon" && (
                            <div className="mt-1 text-[11px] text-primary">
                              Recommended · matches home screen
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="mt-6 border-t pt-4 space-y-3">
                      <div className="font-medium">Add your own</div>
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          type="color"
                          value={customA}
                          onChange={(e) => setCustomA(e.target.value)}
                          className="h-10 w-full rounded"
                        />
                        <input
                          type="color"
                          value={customB}
                          onChange={(e) => setCustomB(e.target.value)}
                          className="h-10 w-full rounded"
                        />
                        <input
                          type="color"
                          value={customC}
                          onChange={(e) => setCustomC(e.target.value)}
                          className="h-10 w-full rounded"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <ThemeBar colors={[customA, customB, customC]} />
                        <Button
                          onClick={() => {
                            setSelectedTheme({
                              id: "custom",
                              name: "Custom",
                              colors: [customA, customB, customC],
                            });
                            setThemeSheetOpen(false);
                          }}
                          className="ml-3"
                        >
                          Save theme
                        </Button>
                      </div>
                    </div>

                    <SheetFooter className="mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setThemeSheetOpen(false)}
                      >
                        Close
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                {/* Live preview chip under the button */}
                <ThemeBar
                  colors={selectedTheme.colors}
                  className="mt-2 hover:scale-105 transition-transform"
                />
              </div>
            </div>
          </Card>

          {/* MIDDLE — plan + prompt (HERO CARD) */}
          <Card className="lg:col-span-6 p-6 h-full bg-black/20 backdrop-blur-sm border-white/10">
            <div className="relative z-10 space-y-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Your Build Plan</h2>
              </div>

              {/* Editable project name */}
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Project name
                </div>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="text-2xl font-semibold metal-text h-auto py-2 bg-background/30"
                  placeholder="Your project name"
                />

                {/* Editable summary */}
                <div className="mt-4 text-sm reveal-diag">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground">Summary</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSummary(!editingSummary)}
                      className="h-6 px-2"
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      {editingSummary ? "Done" : "Edit"}
                    </Button>
                  </div>
                  {editingSummary ? (
                    <Textarea
                      value={projectSummary}
                      onChange={(e) => setProjectSummary(e.target.value)}
                      className="min-h-[60px] bg-background/30"
                    />
                  ) : (
                    <p className="text-base">{projectSummary}</p>
                  )}
                </div>

                <div className="mt-4 text-sm reveal-diag">
                  <div className="text-muted-foreground mb-1">Stack</div>
                  <p className="text-base">
                    {deployPreset === "beginner"
                      ? "Starter stack (cheap hosting, simple CI)"
                      : deployPreset === "pro"
                        ? "Pro stack (Git + CI, observability, CDN)"
                        : deployPreset === "business"
                          ? "Business-ready (teams, SSO, tracing)"
                          : "Custom deployment"}
                  </p>
                </div>
              </div>

              {/* Editable prompt */}
              <div className="mt-6">
                <Label className="text-sm">Prompt</Label>
                <Textarea
                  value={editablePrompt}
                  onChange={(e) => setEditablePrompt(e.target.value)}
                  className="mt-1.5 bg-background/30 min-h-[80px]"
                  placeholder="Describe what you want to build..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  We'll use this prompt in the Workspace. You can refine it
                  anytime.
                </p>
              </div>
            </div>
          </Card>

          {/* RIGHT — actions */}
          <Card
            className={`lg:col-span-3 p-6 h-full bg-black/20 backdrop-blur-sm border-white/10 ${
              isReady ? "ring-2 ring-primary/30" : ""
            }`}
          >
            <div className="relative z-10 space-y-4">
              <h2 className="text-lg font-semibold">Actions</h2>

              <Button
                onClick={openWorkspace}
                className="w-full btn btn-magnetic h-12 text-base font-semibold"
                disabled={!isReady}
              >
                Open Workspace & Start Building
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                We'll create a workspace with your theme, deployment preset, and
                prompt.
              </p>

              <Button
                onClick={saveToLibrary}
                variant="secondary"
                className="w-full btn btn-magnetic"
              >
                Save to Library
              </Button>

              {/* Technical info - collapsed by default */}
              <button
                onClick={() => setShowTechInfo(!showTechInfo)}
                className="text-xs text-muted-foreground flex items-center gap-1 mx-auto hover:text-foreground transition-colors"
              >
                <Info className="h-3 w-3" />
                {showTechInfo ? "Hide" : "Show"} technical info
              </button>

              {showTechInfo && (
                <div className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1.5 font-mono">
                  Job ID: {jobId}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ThemeBar({
  colors,
  className = "",
}: {
  colors: [string, string, string] | string[];
  className?: string;
}) {
  const [c1, c2, c3] = colors as string[];
  return (
    <div
      className={`rounded-md overflow-hidden border ${className}`}
      style={{
        background: `linear-gradient(90deg, ${c1} 0 33%, ${c2} 33% 66%, ${c3} 66% 100%)`,
        height: 28,
      }}
    />
  );
}

function PresetCard({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border text-left hover-elevate transition-all ${
        active ? "ring-2 ring-primary bg-primary/5" : ""
      }`}
    >
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{desc}</div>
    </button>
  );
}