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
    <section className="relative flex min-h-[calc(100vh-64px)] items-center overflow-hidden bg-[#020617] text-slate-100">
      {/* Background geometry + texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Hard panels – no gradients, just colored planes */}
        <div className="absolute -top-40 -left-40 h-[140%] w-[65%] -rotate-12 bg-[#050816]" />
        <div className="absolute -top-52 left-10 h-[150%] w-[60%] -rotate-12 bg-[#0b1220]" />
        <div className="absolute -top-44 left-1/2 h-[145%] w-[60%] -rotate-12 bg-[#020617]" />
        <div className="absolute -top-36 left-[70%] h-[145%] w-[55%] -rotate-12 bg-[#0f172a]" />

        {/* Color accents as panels, not floods */}
        <div className="absolute inset-y-0 left-[-10%] w-1/3 -rotate-12 bg-[#0b3b36]/40 mix-blend-soft-light" />
        <div className="absolute inset-y-10 right-[-8%] w-1/4 -rotate-12 bg-[#1d2441]/55 mix-blend-soft-light" />

        {/* Vignette + central light (gloss from above) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#e5ddcf22_0,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(15,23,42,0.95)_0,transparent_70%)] opacity-70" />

        {/* Fine brushed texture */}
        <div className="absolute inset-0 opacity-[0.22] mix-blend-soft-light bg-[repeating-linear-gradient(90deg,rgba(148,163,184,0.18)_0,rgba(148,163,184,0.18)_1px,transparent_1px,transparent_4px)]" />
        <div className="absolute inset-0 opacity-[0.12] mix-blend-soft-light bg-[repeating-linear-gradient(0deg,rgba(15,23,42,0.35)_0,rgba(15,23,42,0.35)_1px,transparent_1px,transparent_3px)]" />

        {/* Glow behind main card */}
        <div className="absolute inset-x-0 top-1/3 mx-auto h-64 max-w-4xl rounded-full bg-[radial-gradient(circle,rgba(248,244,236,0.5)_0,transparent_70%)] blur-3xl" />

        {/* Floor under console */}
        <div className="absolute inset-x-0 bottom-6 mx-auto h-40 max-w-4xl rounded-[999px] bg-[radial-gradient(circle,rgba(15,23,42,0.85)_0,transparent_70%)] opacity-70 blur-2xl" />

        {/* Top light strip to tie into black header */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black via-black/80 to-transparent" />
      </div>

      {/* Hero content */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 sm:px-6 lg:px-8">
        {/* Main glossy card */}
        <div className="rounded-[30px] border border-white/70 bg-[#f7f1e6] px-8 py-10 shadow-[0_32px_90px_rgba(0,0,0,0.7)] sm:px-12 sm:py-12">
          <div className="pointer-events-none absolute inset-x-16 top-[18%] h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-60" />
          <h1 className="relative text-center text-4xl font-semibold tracking-tight text-[#0f172a] sm:text-5xl md:text-6xl">
            From Idea to Digital{" "}
            <span className="mt-1 block">Reality</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="mt-7 text-[11px] font-medium tracking-[0.32em] text-slate-300/90">
          BUILD SMARTER. LAUNCH FASTER
        </p>

        {/* Command surface: console-style */}
        <div className="mt-10 w-full max-w-3xl rounded-[999px] border border-slate-500/60 bg-[#020617]/80 px-3 py-3 shadow-[0_28px_80px_rgba(0,0,0,0.9)] backdrop-blur-sm">
          <div className="rounded-[999px] bg-[#050b16]/95 px-4 py-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.4)]">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
              onSubmit={handleCreate}
            >
              <label className="sr-only" htmlFor="hero-idea-input">
                Describe your website or app idea
              </label>

              <input
                id="hero-idea-input"
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Describe your website or app idea..."
                className="w-full rounded-2xl border border-slate-600/70 bg-[#020617] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 outline-none ring-0 transition focus:border-[#d4a15a] focus:ring-1 focus:ring-[#d4a15a]/70 sm:text-base"
              />

              {/* Premium hardware-style button */}
              <div className="shrink-0 rounded-full bg-gradient-to-r from-[#f7e0b9] via-[#d4a15a] to-[#f7e0b9] p-[1px]">
                <Button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#020617] px-6 text-sm font-semibold text-[#fdfbf7] shadow-[0_14px_40px_rgba(0,0,0,0.8)] transition-transform transition-shadow hover:-translate-y-[1px] hover:shadow-[0_20px_60px_rgba(0,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a15a]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
                >
                  Create
                </Button>
              </div>
            </form>

            <div className="mt-2 flex items-center justify-center">
              <button
                type="button"
                className="text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-100"
              >
                or Explore previews →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
