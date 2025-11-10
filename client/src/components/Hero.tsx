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
    <section className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden bg-[#020617] text-slate-50">
      {/* ===== BACKGROUND LAYERS ===== */}
      {/* animated hero gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-hero-gradient animate-hero-gradient"
      />

      {/* left body panel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-[-10%] h-[130%] w-[52%] -rotate-8 rounded-[72px] bg-[linear-gradient(to_bottom,#020617,#1d4ed8,#0ea5e9)] opacity-80"
      />

      {/* right body panel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-[-14%] h-[130%] w-[52%] rotate-7 rounded-[72px] bg-[linear-gradient(to_bottom,#020617,#b91c1c,#f97316,#facc15)] opacity-85"
      />

      {/* central dark band behind cards */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-10%] top-[18%] h-[52%] rounded-[64px] bg-[radial-gradient(circle_at_center,#020617_0,#020617_45%,rgba(15,23,42,0.9)_70%,transparent_100%)] opacity-95"
      />

      {/* glow under command surface */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[10%] mx-auto h-48 max-w-3xl rounded-[999px] bg-[radial-gradient(circle,#0ea5e9_0,rgba(56,189,248,0.0)_65%)] opacity-40 blur-3xl"
      />

      {/* noise / grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-[0.20] hero-noise"
      />

      {/* ===== FOREGROUND CONTENT ===== */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 sm:px-6 lg:px-8">
        {/* headline card */}
        <div className="rounded-[32px] border border-white/20 bg-[radial-gradient(circle_at_top,#ffffff,#f4e9dc)] px-8 py-10 shadow-[0_32px_90px_rgba(0,0,0,0.6)] sm:px-12 sm:py-12">
          <h1 className="text-center text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            From Idea to Digital{" "}
            <span className="mt-1 block">Reality</span>
          </h1>
        </div>

        {/* tagline */}
        <p className="mt-7 text-xs font-semibold tracking-[0.35em] text-slate-200/90">
          BUILD SMARTER. LAUNCH FASTER
        </p>

        {/* prompt bar */}
        <div className="mt-10 w-full max-w-3xl rounded-[999px] border border-white/40 bg-white/90 px-3 py-2 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
            onSubmit={handleCreate}
          >
            <label htmlFor="hero-idea-input" className="sr-only">
              Describe your website or app idea
            </label>

            <input
              id="hero-idea-input"
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe your website or app idea..."
              className="w-full rounded-[999px] border border-transparent bg-white/0 px-5 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-0 transition focus:border-slate-300 focus:ring-0 sm:text-base"
            />

            <Button
              type="submit"
              className="h-[46px] shrink-0 rounded-[999px] border border-[#f4d38a] bg-[radial-gradient(circle_at_top,#ffffff,#020617)] px-7 text-sm font-semibold text-slate-50 shadow-[0_0_0_1px_rgba(15,23,42,0.9),0_16px_40px_rgba(0,0,0,0.75)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white/10"
            >
              Create
            </Button>
          </form>

          <div className="mt-2 flex items-center justify-center pb-1">
            <button
              type="button"
              className="text-xs font-medium text-slate-300 transition-colors hover:text-slate-100"
            >
              or Explore previews →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
