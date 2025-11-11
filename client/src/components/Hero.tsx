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
      });
    }
  }

  return (
    <section
      className="relative isolate flex min-h-[calc(100vh-56px)] items-center overflow-hidden bg-slate-950 text-slate-50"
    >
      {/* === BACKGROUND LAYERS === */}
      {/* Your orange → beige gradient as the base */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            "linear-gradient(90deg, hsla(34, 98%, 50%, 1) 0%, hsla(32, 37%, 84%, 1) 100%)",
        }}
      />

      {/* Soft coloured glow under the console */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 h-[420px] w-[860px] -translate-x-1/2 rounded-[999px] bg-[radial-gradient(circle_at_center,_#38bdf8_0,_#6366f1_35%,_#f97316_75%,transparent_100%)] opacity-75 blur-3xl"
      />

      {/* Fine noise so it doesn’t feel flat */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.10] mix-blend-soft-light"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(15,23,42,0.3)_0,rgba(15,23,42,0.3)_1px,transparent_1px,transparent_3px),repeating-linear-gradient(90deg,rgba(15,23,42,0.25)_0,rgba(15,23,42,0.25)_1px,transparent_1px,transparent_3px)",
        }}
      />

      {/* Subtle fade at the very bottom so the next section can sit on white */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 -z-10 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-50"
      />

      {/* === CONTENT === */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8 lg:flex-row lg:items-center">
        {/* LEFT: Copy + prompt */}
        <div className="flex-1 space-y-8">
          {/* Tagline */}
          <p className="text-[11px] font-semibold tracking-[0.35em] text-slate-800 uppercase">
            BUILD SMARTER · LAUNCH FASTER
          </p>

          {/* Main headline */}
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Describe your next product in plain language.
            <span className="mt-3 block text-lg font-normal text-slate-800 sm:text-xl">
              Ybuilt turns that idea into layouts, logic, and live previews on a
              single calm canvas.
            </span>
          </h1>

          {/* Prompt surface */}
          <div className="mt-4 max-w-xl rounded-2xl border border-slate-200/70 bg-white/80 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl">
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
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-0 transition focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-500/40"
              />

              <Button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(15,23,42,0.45)] transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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

        {/* RIGHT: “Idea Console” visual */}
        <div className="flex-1">
          <div className="relative mx-auto w-full max-w-md rounded-[28px] border border-slate-900/10 bg-slate-900/5 px-5 py-5 shadow-[0_30px_100px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
            {/* Console header */}
            <div className="mb-4 flex items-center justify-between text-xs text-slate-800">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-slate-900">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Idea console
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Design · Logic · Live
              </span>
            </div>

            <div className="space-y-3">
              {/* Lane 1 – layout / design */}
              <div className="rounded-2xl bg-white/80 p-3 border border-slate-200/80">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-slate-500">
                  <span>Layout</span>
                  <span className="h-1 w-10 rounded-full bg-sky-400/60" />
                </div>
                <div className="flex gap-2">
                  <div className="h-16 flex-1 rounded-xl bg-slate-100" />
                  <div className="flex w-16 flex-col gap-2">
                    <div className="h-7 rounded-lg bg-slate-100" />
                    <div className="h-7 rounded-lg bg-slate-50" />
                  </div>
                </div>
              </div>

              {/* Lane 2 – logic / flows */}
              <div className="rounded-2xl bg-white/80 p-3 border border-slate-200/80">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-slate-500">
                  <span>Logic</span>
                  <span className="h-1 w-10 rounded-full bg-emerald-400/70" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-[11px] text-slate-900">
                    Trigger
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-[11px] text-slate-900">
                    Condition
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-[11px] text-slate-900">
                    Action
                  </span>
                </div>
              </div>

              {/* Lane 3 – live preview */}
              <div className="rounded-2xl bg-white/80 p-3 border border-slate-200/80">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-slate-500">
                  <span>Preview</span>
                  <span className="h-1 w-10 rounded-full bg-fuchsia-400/70" />
                </div>
                <div className="flex gap-3">
                  <div className="h-14 flex-1 rounded-xl bg-gradient-to-br from-sky-500/70 via-indigo-500/70 to-fuchsia-500/70" />
                  <div className="flex w-16 flex-col justify-between text-[10px] text-slate-700">
                    <span className="rounded-lg bg-slate-900/5 px-2 py-1 text-center">
                      Web
                    </span>
                    <span className="rounded-lg bg-slate-900/5 px-2 py-1 text-center">
                      Mobile
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Glow line under console */}
            <div className="pointer-events-none absolute inset-x-6 -bottom-4 h-10 rounded-full bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.7),transparent_65%)] opacity-80" />
          </div>
        </div>
      </div>
    </section>
  );
}
