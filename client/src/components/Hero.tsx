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
    <section className="relative flex min-h-[calc(100vh-64px)] items-center overflow-hidden bg-[#f3eee7] text-slate-900">
      {/* Background geometry + texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Deep panels */}
        <div className="absolute -left-1/2 -top-1/3 h-[140%] w-[45%] -rotate-12 bg-[#e0d2c2] opacity-80" />
        <div className="absolute -left-1/8 -top-1/3 h-[140%] w-[46%] -rotate-12 bg-[#d4c7b7] opacity-75" />
        <div className="absolute left-1/6 -top-1/3 h-[140%] w-[46%] -rotate-12 bg-[#cbd5e1] opacity-35" />
        <div className="absolute left-1/2 -top-1/3 h-[140%] w-[46%] -rotate-12 bg-[#c8d4ce] opacity-45" />

        {/* Vignette + central light */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff_0,#f3eee7_48%,#d8ccbe_100%)] opacity-95" />

        {/* Fine grain / texture */}
        <div className="absolute inset-0 mix-blend-soft-light opacity-60 bg-[radial-gradient(circle_at_0_0,rgba(15,23,42,0.05)_0,transparent_55%),radial-gradient(circle_at_100%_0,rgba(15,23,42,0.04)_0,transparent_55%)]" />

        {/* Glow behind card */}
        <div className="absolute inset-x-0 top-1/3 mx-auto h-60 max-w-3xl rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.16)_0,transparent_65%)] blur-3xl" />

        {/* Floor under command surface */}
        <div className="absolute inset-x-0 bottom-10 mx-auto h-40 max-w-4xl rounded-[999px] bg-[radial-gradient(circle,rgba(15,23,42,0.18)_0,transparent_70%)] opacity-70 blur-2xl" />

        {/* Top highlight strip */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/75 via-white/30 to-transparent" />
      </div>

      {/* Hero content */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 sm:px-6 lg:px-8">
        {/* Main glossy card */}
        <div className="rounded-[28px] border border-white/80 bg-gradient-to-b from-[#fdfbf7] via-[#f7eee3] to-[#e8dbcd] px-8 py-10 shadow-[0_30px_90px_rgba(15,23,42,0.22)] sm:px-12 sm:py-12">
          <h1 className="text-center text-4xl font-semibold tracking-tight text-[#0f172a] sm:text-5xl md:text-6xl">
            From Idea to Digital{" "}
            <span className="mt-1 block">Reality</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="mt-7 text-[11px] font-medium tracking-[0.32em] text-slate-500/85">
          BUILD SMARTER. LAUNCH FASTER
        </p>

        {/* Command surface: input + button */}
        <div className="mt-10 w-full max-w-2xl rounded-3xl border border-slate-200/75 bg-white/85 px-6 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.2)] backdrop-blur-sm">
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
              className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-0 transition focus:border-[#0b3b36] focus:ring-1 focus:ring-[#0b3b36]/60 sm:text-base"
            />

            {/* Premium hardware-style button */}
            <div className="shrink-0 rounded-full bg-gradient-to-r from-[#f7e0b9] via-[#d4a15a] to-[#f7e0b9] p-[1px]">
              <Button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#0f172a] px-6 text-sm font-semibold text-[#fdfbf7] shadow-[0_14px_40px_rgba(15,23,42,0.55)] transition-transform transition-shadow hover:-translate-y-[1px] hover:shadow-[0_20px_60px_rgba(15,23,42,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a15a]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white/70"
              >
                Create
              </Button>
            </div>
          </form>

          <div className="mt-3 flex items-center justify-center">
            <button
              type="button"
              className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              or Explore previews →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
