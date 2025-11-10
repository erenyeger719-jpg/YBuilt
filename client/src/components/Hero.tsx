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
        ct.includes("application/json") && bodyText
          ? JSON.parse(bodyText)
          : {};

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
    <section className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden bg-black text-slate-50">
      {/* === VIDEO BACKGROUND === */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src="/media/header-loop.mp4"   // <- your 5s clip here
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/media/header-loop-poster.jpg" // optional still frame
      />

      {/* Tint + vignette so text is readable over crazy colors */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        {/* dark vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,#00000080_65%,#000000f4_100%)]" />
        {/* soft aura glow behind content */}
        <div className="absolute inset-x-0 top-1/3 mx-auto h-64 max-w-3xl rounded-full bg-[radial-gradient(circle,#ffffff33_0,transparent_70%)] blur-3xl" />
        {/* subtle grain */}
        <div
          className="absolute inset-0 opacity-25 mix-blend-soft-light"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(255,255,255,0.09) 0,rgba(255,255,255,0.09) 1px,transparent 1px,transparent 3px),repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0,rgba(255,255,255,0.04) 1px,transparent 1px,transparent 3px)",
          }}
        />
      </div>

      {/* === FOREGROUND CONTENT === */}
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-10 px-4 py-16 sm:px-6 lg:px-8">
        {/* Title card */}
        <div className="rounded-[30px] border border-white/35 bg-gradient-to-b from-white/96 via-white/92 to-white/86 px-8 py-9 text-center shadow-[0_40px_140px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:px-12 sm:py-11">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            From Idea to Digital
            <span className="mt-1 block">Reality</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-[11px] font-semibold tracking-[0.35em] text-slate-200/90">
          BUILD SMARTER. LAUNCH FASTER
        </p>

        {/* Prompt bar */}
        <div className="w-full max-w-3xl rounded-[999px] bg-white/10 p-[2px] shadow-[0_26px_80px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
          <div className="flex items-center gap-2 rounded-[999px] bg-gradient-to-r from-slate-950/90 via-slate-950/85 to-slate-900/90 px-3 py-3">
            <form
              className="flex w-full flex-col gap-3 sm:flex-row sm:items-center"
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
                className="w-full rounded-[999px] border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-100 placeholder:text-slate-400 outline-none ring-0 transition focus:border-amber-300/80 focus:bg-white/10 focus:ring-2 focus:ring-amber-300/60 sm:text-base"
              />

              <div className="mt-1 flex justify-end sm:mt-0 sm:ml-2">
                <div className="rounded-[999px] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 p-[2px] shadow-[0_0_0_1px_rgba(248,250,252,0.45),0_18px_40px_rgba(0,0,0,0.9)]">
                  <Button
                    type="submit"
                    className="h-11 rounded-[999px] bg-[#020617] px-6 text-sm font-semibold tracking-wide text-slate-50 shadow-[0_8px_24px_rgba(15,23,42,0.9)] transition-transform transition-shadow hover:-translate-y-[1px] hover:shadow-[0_16px_40px_rgba(15,23,42,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
