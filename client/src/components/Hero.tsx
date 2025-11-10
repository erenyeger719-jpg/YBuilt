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
    <section className="relative flex min-h-[calc(100vh-64px)] items-center overflow-hidden bg-[#050509] text-slate-100">
      {/* BACKGROUND GEOMETRY + TEXTURE */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Base charcoal slabs */}
        <div className="absolute -top-40 -left-40 h-[140%] w-[70%] -rotate-14 bg-[#050509]" />
        <div className="absolute -top-56 left-10 h-[150%] w-[60%] -rotate-14 bg-[#0c1019]" />
        <div className="absolute -top-48 left-1/2 h-[150%] w-[60%] -rotate-14 bg-[#0b0f18]" />
        <div className="absolute -top-44 left-[72%] h-[145%] w-[55%] -rotate-14 bg-[#10131d]" />

        {/* Color panels (solid, not gradients) */}
        {/* Royal blue */}
        <div className="absolute -top-24 left-[18%] h-[130%] w-[10%] -rotate-14 bg-[#2838ff]" />
        {/* Autumn orange */}
        <div className="absolute -top-16 left-[45%] h-[130%] w-[6%] -rotate-14 bg-[#e1692d]" />
        {/* Deep red */}
        <div className="absolute -top-10 left-[63%] h-[130%] w-[5%] -rotate-14 bg-[#b3202f]" />
        {/* Warm yellow */}
        <div className="absolute -top-8 left-[78%] h-[130%] w-[7%] -rotate-14 bg-[#f3c647]" />

        {/* Subtle light pool behind hero card (solid + blur, not gradient) */}
        <div className="absolute inset-x-0 top-1/3 mx-auto h-64 max-w-4xl rounded-full bg-[#f5eee0] opacity-15 blur-3xl" />

        {/* Dark floor under console */}
        <div className="absolute inset-x-0 bottom-4 mx-auto h-40 max-w-4xl rounded-[999px] bg-black opacity-40 blur-2xl" />

        {/* Fine vertical + horizontal line texture */}
        <div className="absolute inset-0 opacity-[0.22] mix-blend-soft-light bg-[repeating-linear-gradient(90deg,rgba(148,163,184,0.18)_0,rgba(148,163,184,0.18)_1px,transparent_1px,transparent_5px)]" />
        <div className="absolute inset-0 opacity-[0.16] mix-blend-soft-light bg-[repeating-linear-gradient(0deg,rgba(15,23,42,0.5)_0,rgba(15,23,42,0.5)_1px,transparent_1px,transparent_4px)]" />

        {/* Upper band tying into black nav */}
        <div className="absolute inset-x-0 top-0 h-24 bg-black" />
      </div>

      {/* HERO CONTENT */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 sm:px-6 lg:px-8">
        {/* Main glossy title card */}
        <div className="relative rounded-[28px] border border-[#f7f0e3] bg-[#f9f3e6] px-8 py-10 shadow-[0_34px_100px_rgba(0,0,0,0.85)] sm:px-12 sm:py-12">
          {/* Top “sheen” bar – gives gloss without gradient */}
          <div className="pointer-events-none absolute inset-x-6 top-4 h-7 rounded-[20px] bg-white/26 blur-[6px] mix-blend-screen" />
          {/* Bottom harder edge */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] rounded-b-[28px] bg-black/25" />

          <h1 className="relative text-center text-4xl font-semibold tracking-tight text-[#050816] sm:text-5xl md:text-6xl">
            From Idea to Digital{" "}
            <span className="mt-1 block">Reality</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="mt-7 text-[11px] font-medium tracking-[0.32em] text-slate-200/90">
          BUILD SMARTER. LAUNCH FASTER
        </p>

        {/* COMMAND SURFACE – “console” */}
        <div className="mt-10 w-full max-w-3xl rounded-[26px] border border-[#202636] bg-[#070a12] px-3 py-3 shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
          {/* Inner console bar */}
          <div className="rounded-[22px] border border-[#3b4255] bg-[#02030a] px-4 py-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.5)]">
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
                className="w-full rounded-[18px] border border-[#2a3246] bg-[#020617] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 outline-none ring-0 transition focus:border-[#f5e0b8] focus:ring-1 focus:ring-[#f5e0b8] sm:text-base"
              />

              {/* Premium “hardware” button with brass ring */}
              <div className="shrink-0 rounded-full border border-[#f5e0b8] bg-[#f5e0b8] px-[2px] py-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.35)]">
                <Button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#050816] px-7 text-sm font-semibold text-[#fdfaf3] shadow-[0_14px_40px_rgba(0,0,0,0.9)] transition-transform transition-shadow hover:-translate-y-[1px] hover:shadow-[0_22px_70px_rgba(0,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5e0b8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
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
