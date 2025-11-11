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
    <section className="relative overflow-hidden rounded-[32px] border border-slate-200/90 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 px-4 py-12 shadow-[0_28px_80px_rgba(15,23,42,0.12)] sm:px-8 sm:py-14 lg:px-12">
      {/* Soft halo + grain so it doesn't feel flat */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        {/* halo behind left content */}
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,#e5f4ff_0,#ffffff_40%,transparent_70%)] opacity-80 blur-3xl" />
        {/* warm halo behind preview */}
        <div className="absolute right-[-60px] bottom-[-40px] h-80 w-80 rounded-full bg-[radial-gradient(circle,#fee2c5_0,#fdf7ee_40%,transparent_70%)] opacity-80 blur-3xl" />
        {/* fine grain */}
        <div
          className="absolute inset-0 opacity-[0.09] mix-blend-soft-light"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(15,23,42,0.18)_0,rgba(15,23,42,0.18)_1px,transparent_1px,transparent_3px),repeating-linear-gradient(90deg,rgba(15,23,42,0.08)_0,rgba(15,23,42,0.08)_1px,transparent_1px,transparent_3px)",
          }}
        />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-center">
        {/* LEFT: copy + prompt */}
        <div className="flex-1 space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/80 px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
            <span>YBUILT STUDIO</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-[2.9rem] md:leading-tight">
              From Idea to Digital{" "}
              <span className="block">Reality</span>
            </h1>

            <p className="text-[11px] font-semibold tracking-[0.35em] text-slate-500">
              BUILD SMARTER. LAUNCH FASTER
            </p>

            <p className="max-w-xl text-sm text-slate-600 sm:text-[15px]">
              Type what you&apos;re imagining. Ybuilt sketches the product,
              wires the logic, and keeps everything editable so you stay in
              control.
            </p>
          </div>

          {/* small trust row */}
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-medium text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              Live preview
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              Version history
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              Export when you&apos;re ready
            </span>
          </div>

          {/* Prompt bar */}
          <div className="mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.09)] backdrop-blur">
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
                placeholder="Describe your website or app idea…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-0 transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900/70"
              />

              <Button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center rounded-[999px] bg-slate-900 px-5 py-3 text-sm font-medium text-slate-50 shadow-[0_14px_32px_rgba(15,23,42,0.45)] transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100"
              >
                Create
              </Button>
            </form>

            <div className="mt-3 flex items-center justify-center">
              <button
                type="button"
                className="text-xs font-medium text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline"
              >
                or Explore previews →
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: preview block – empty for now but designed */}
        <div className="flex-1">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-md rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-[0_26px_70px_rgba(15,23,42,0.45)]">
            {/* top chrome */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[11px] text-slate-300/90">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400/80" />
                <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
              </div>
              <span className="truncate text-xs text-slate-300/80">
                preview.ybuilt.app · concept
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] tracking-wide">
                Live
              </span>
            </div>

            {/* body – pure placeholders for now */}
            <div className="relative h-full px-5 py-4">
              {/* subtle diagonal light */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1f2937_0,transparent_55%),linear-gradient(135deg,rgba(248,250,252,0.02)_0,rgba(248,250,252,0.16)_35%,transparent_70%)] opacity-70" />

              <div className="relative flex h-full flex-col gap-3">
                <div className="mt-1 h-6 w-40 rounded-full bg-white/10" />
                <div className="h-4 w-56 rounded-full bg-white/6" />
                <div className="mt-4 flex gap-3">
                  <div className="h-28 flex-1 rounded-2xl border border-white/8 bg-white/5" />
                  <div className="h-28 flex-1 rounded-2xl border border-white/8 bg-white/5" />
                </div>
                <div className="mt-auto h-8 w-32 rounded-full bg-white/12" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
