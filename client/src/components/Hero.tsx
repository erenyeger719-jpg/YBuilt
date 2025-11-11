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
      className="relative flex min-h-[calc(100vh-56px)] items-center justify-center overflow-hidden bg-[#020617] text-slate-50"
    >
      {/* === SPOTIFY / LOVABLE STYLE GRADIENT BACKGROUND === */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(circle at top, #1ed760 0, #1ed76033 26%, transparent 55%),
            radial-gradient(circle at 15% 120%, #fb923c 0, #fb923c33 28%, transparent 60%),
            radial-gradient(circle at 85% 120%, #6366f1 0, #6366f133 28%, transparent 60%),
            radial-gradient(circle at center, #0f172a 0, #020617 70%)
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "140% 140%",
          backgroundPosition: "center",
        }}
      />

      {/* === GRAIN / NOISE OVERLAY (VISIBLE) === */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 mix-blend-soft-light"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(255,255,255,0.10)_0,rgba(255,255,255,0.10)_1px,transparent_1px,transparent_3px),repeating-linear-gradient(90deg,rgba(0,0,0,0.55)_0,rgba(0,0,0,0.55)_1px,transparent_1px,transparent_4px)",
        }}
      />

      {/* === CENTERED CONTENT === */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Tagline */}
          <p className="mb-4 text-[11px] font-semibold tracking-[0.35em] text-slate-200 uppercase">
            BUILD SMARTER · LAUNCH FASTER
          </p>

          {/* Headline */}
          <div className="mb-8">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl md:text-6xl lg:text-7xl">
              Describe your next product in plain language.
              <span className="mt-2 block text-lg font-normal text-slate-200 sm:text-xl">
                Ybuilt turns that idea into something your users can actually
                click, try, and share.
              </span>
            </h1>
          </div>

          {/* Prompt surface */}
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700/70 bg-white/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-sm">
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
                className="w-full rounded-xl border border-slate-200/70 bg-white/90 px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-0 transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-400/40"
              />

              <Button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-medium text-white shadow-[0_18px_40px_rgba(0,0,0,0.8)] transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                Create
              </Button>
            </form>

            <div className="mt-3 flex items-center justify-center">
              <button
                type="button"
                className="text-xs font-medium text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline"
              >
                or Explore previews →
              </button>
            </div>
          </div>

          {/* Placeholder for future visual */}
          <div className="mt-12 text-xs text-slate-400">
            Future: product preview / animation goes here
          </div>
        </div>
      </div>
    </section>
  );
}
