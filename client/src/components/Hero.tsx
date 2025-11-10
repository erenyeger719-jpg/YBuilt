// client/src/components/Hero.tsx
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Hero() {
  const { toast } = useToast();
  const [promptText, setPromptText] = useState("");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const prompt = promptText.trim();
    if (!prompt) return;

    try {
      console.log("[hero] starting fetch → /api/generate", { prompt });

      const r = await fetch("/api/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, promptText: prompt }),
      });

      const ct = r.headers.get("content-type") || "";
      const bodyText = await r.text();
      const data =
        ct.includes("application/json") && bodyText ? JSON.parse(bodyText) : {};

      console.log("[hero] status:", r.status, "data:", data);

      if (!r.ok) {
        const msg =
          (data as any)?.message ||
          (data as any)?.error ||
          r.statusText ||
          "Request failed";
        const err: any = new Error(msg);
        err.status = r.status;
        err.body = data;
        throw err;
      }

      const id =
        (data as any).jobId ||
        (data as any).id ||
        (data as any)?.job?.id ||
        (data as any)?.data?.jobId ||
        (data as any)?.data?.id;

      if (!id) throw new Error("No jobId in response");

      const target = `/workspace/${id}`;
      console.log("[hero] redirect →", target);
      window.location.assign(target);
      setTimeout(() => {
        window.location.href = target;
      }, 50);
    } catch (err: any) {
      if (err?.status === 401) {
        toast({
          title: "Sign in required",
          description: "Please sign in to create a project.",
          variant: "destructive",
        });
        return;
      }
      console.error("[hero] error:", err);
      toast({
        title: "Create failed",
        description: err?.message || "Request failed",
        variant: "destructive",
      });
    }
  }

  return (
    <section className="relative flex min-h-[calc(100vh-64px)] items-center overflow-hidden bg-[#050509] text-slate-50">
      {/* Sculpted cockpit panel + color inlays */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex justify-center"
      >
        <div className="relative mt-10 mb-10 h-[460px] w-[1200px] max-w-[92vw] rounded-[56px] border border-white/10 bg-[#f4e9dd] shadow-[0_42px_140px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* left and right black “body” edges */}
          <div className="absolute -left-[22%] inset-y-[-16%] w-[26%] bg-[#050509]" />
          <div className="absolute -right-[22%] inset-y-[-16%] w-[26%] bg-[#050509]" />

          {/* color inlay bars – solid colors, angled, clipped to the curved panel */}
          {/* deep navy base strip */}
          <div className="absolute -left-[8%] top-[-8%] h-[130%] w-[22%] -rotate-8 rounded-[52px] bg-[#020617]" />
          {/* royal blue */}
          <div className="absolute -left-[1%] top-[-10%] h-[135%] w-[20%] -rotate-6 rounded-[52px] bg-[#1d4ed8]" />
          {/* autumn orange */}
          <div className="absolute left-[26%] top-[-10%] h-[135%] w-[16%] -rotate-6 rounded-[52px] bg-[#ea580c]" />
          {/* Ferrari red */}
          <div className="absolute left-[46%] top-[-10%] h-[135%] w-[16%] -rotate-6 rounded-[52px] bg-[#b91c1c]" />
          {/* warm gold */}
          <div className="absolute right-[-4%] top-[-8%] h-[130%] w-[20%] -rotate-4 rounded-[52px] bg-[#f59e0b]" />

          {/* subtle light + texture overlays */}
          <div className="absolute inset-x-[-10%] top-0 h-28 bg-gradient-to-b from-white/80 via-white/30 to-transparent" />
          <div className="absolute inset-x-[-10%] bottom-0 h-32 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0_0,#ffffff19,transparent_60%),radial-gradient(circle_at_100%_0,#ffffff12,transparent_55%)] mix-blend-soft-light" />
        </div>
      </div>

      {/* Hero content */}
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-16 sm:px-6 lg:px-8">
        {/* Headline card */}
        <div className="rounded-[28px] border border-white/70 bg-[#f9f4ec]/95 px-8 py-8 shadow-[0_26px_80px_rgba(15,23,42,0.65)] sm:px-12 sm:py-10">
          <h1 className="text-center font-serif text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            From Idea to Digital <span className="mt-2 block">Reality</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="mt-8 text-[11px] font-semibold tracking-[0.35em] text-slate-200/85">
          BUILD SMARTER. LAUNCH FASTER
        </p>

        {/* Command surface: glossy prompt pill */}
        <div className="mt-8 w-full max-w-3xl rounded-[999px] border border-white/80 bg-white/95 px-3 py-3 shadow-[0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur">
          <form className="flex items-stretch gap-2" onSubmit={handleCreate}>
            <label className="sr-only" htmlFor="hero-idea-input">
              Describe your website or app idea
            </label>

            {/* Inner pill with subtle inner shadow */}
            <div className="flex-1 rounded-[999px] border border-slate-200/70 bg-white/85 px-5 py-3 shadow-inner flex items-center">
              <input
                id="hero-idea-input"
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Describe your website or app idea..."
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>

            {/* Ignition-style Create button */}
            <Button
              type="submit"
              className="relative ml-1 flex h-12 min-w-[120px] items-center justify-center rounded-[999px] border border-[#f5e9d5] bg-[#020617] px-6 text-sm font-semibold text-slate-50 shadow-[0_16px_40px_rgba(15,23,42,0.95)] before:absolute before:inset-[2px] before:rounded-[999px] before:border before:border-[#facc15]/70 before:content-[''] hover:bg-[#020617] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white/40"
            >
              <span className="relative z-10">Create</span>
            </Button>
          </form>

          <div className="mt-3 flex items-center justify-center">
            <button
              type="button"
              className="text-[11px] font-medium text-slate-300 transition-colors hover:text-slate-50"
            >
              or Explore previews →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
