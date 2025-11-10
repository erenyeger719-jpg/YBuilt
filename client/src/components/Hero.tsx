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
    <section className="relative flex min-h-[calc(100vh-64px)] items-center overflow-hidden bg-[#f6eee4] text-slate-900">
      {/* ================= BACKGROUND LAYERS (body paint + interior colours) ================= */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* soft porcelain base tint + a hint of texture */}
        <div className="absolute inset-0 opacity-70" />

        {/* big curved colour “panels” – angled, not flat stripes */}
        {/* deep navy base */}
        <div className="absolute -left-40 -top-24 h-[140%] w-56 rotate-[-18deg] rounded-[64px] bg-[#020617]" />
        {/* royal blue */}
        <div className="absolute -left-4 -top-40 h-[150%] w-40 rotate-[-10deg] rounded-[64px] bg-[#1d4ed8]" />
        {/* autumn orange */}
        <div className="absolute left-64 -top-40 h-[150%] w-40 rotate-[-6deg] rounded-[64px] bg-[#ea580c]" />
        {/* racing red */}
        <div className="absolute right-64 -top-40 h-[150%] w-40 rotate-[8deg] rounded-[64px] bg-[#b91c1c]" />
        {/* gold / yellow */}
        <div className="absolute right-12 -top-32 h-[150%] w-44 rotate-[16deg] rounded-[64px] bg-[#f5b301]" />
        {/* subtle sage accent behind input */}
        <div className="absolute inset-x-32 bottom-[-8%] h-72 rounded-[999px] bg-[#0f766e]/10 blur-3xl" />

        {/* top glossy light strip */}
        <div className="absolute inset-x-0 top-0 h-24 bg-white/40 backdrop-blur-[2px]" />

        {/* overall vignette so centre pops */}
        <div className="absolute inset-0 bg-black/10 mix-blend-multiply" />
      </div>

      {/* ================= HERO CONTENT ================= */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 sm:px-6 lg:px-8">
        {/* Main headline card */}
        <div className="relative rounded-[32px] border border-white/80 bg-[#f9f4ec] px-8 py-10 shadow-[0_32px_90px_rgba(15,23,42,0.38)] sm:px-12 sm:py-12">
          {/* glossy top highlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-0 h-12 rounded-t-[32px] bg-white/70 blur-xl"
          />

          <h1 className="relative text-center text-4xl font-semibold tracking-tight text-[#050816] sm:text-5xl md:text-6xl">
            From Idea to Digital{" "}
            <span className="mt-1 block">Reality</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="mt-7 text-xs font-semibold tracking-[0.35em] text-slate-200/90">
          <span className="inline-block bg-[#020617] px-3 py-1 rounded-full/3">
            BUILD SMARTER. LAUNCH FASTER
          </span>
        </p>

        {/* Command surface – glossy white pill, dark nav interior */}
        <div className="mt-10 w-full max-w-3xl rounded-[999px] border border-white/90 bg-white/90 px-3 py-3 shadow-[0_26px_80px_rgba(2,8,23,0.6)] backdrop-blur-md">
          <form
            className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
            onSubmit={handleCreate}
          >
            {/* subtle inner highlight for gloss */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-6 top-0 h-8 rounded-full bg-white/70 blur-lg"
            />

            <label className="sr-only" htmlFor="hero-idea-input">
              Describe your website or app idea
            </label>

            <input
              id="hero-idea-input"
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe your website or app idea..."
              className="relative w-full rounded-[999px] border border-transparent bg-[#f7f7fb]/90 px-5 py-3 text-sm text-[#020617] placeholder:text-slate-400 outline-none ring-0 transition sm:text-base focus:border-[#020617]/40 focus:ring-2 focus:ring-[#020617]/40"
            />

            {/* “Create” as dark metal + gold ring, like a start button */}
            <Button
              type="submit"
              className="relative inline-flex shrink-0 items-center justify-center rounded-[999px] border border-[#f4c15d]/80 bg-[#020617] px-7 py-3 text-sm font-semibold tracking-wide text-slate-50 shadow-[0_16px_40px_rgba(15,23,42,0.7)] transition hover:translate-y-[1px] hover:shadow-[0_12px_30px_rgba(15,23,42,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c15d]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white/60"
            >
              Create
            </Button>
          </form>

          <div className="mt-3 flex items-center justify-center">
            <button
              type="button"
              className="text-xs font-medium text-slate-600 transition-colors hover:text-[#020617]"
            >
              or Explore previews →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
