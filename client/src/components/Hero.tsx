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
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12 shadow-sm sm:px-8 sm:py-14 lg:px-10">
      {/* subtle grain so it doesn't feel flat */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-soft-light"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(15,23,42,0.15)_0,rgba(15,23,42,0.15)_1px,transparent_1px,transparent_3px),repeating-linear-gradient(90deg,rgba(15,23,42,0.08)_0,rgba(15,23,42,0.08)_1px,transparent_1px,transparent_3px)",
        }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-center">
        {/* LEFT: text + prompt */}
        <div className="flex-1 space-y-7">
          <p className="inline-flex items-center rounded-full border border-slate-300/70 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Build studio · Ybuilt
          </p>

          <div className="space-y-3">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              From Idea to Digital{" "}
              <span className="block">Reality</span>
            </h1>

            <p className="text-[11px] font-semibold tracking-[0.35em] text-slate-500">
              BUILD SMARTER. LAUNCH FASTER
            </p>

            <p className="max-w-xl text-sm text-slate-600 sm:text-[15px]">
              Describe what you want to ship. Ybuilt turns it into a working
              product, then lets you refine it without drowning in settings.
            </p>
          </div>

          {/* Prompt surface */}
          <div className="mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur">
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
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-slate-50 shadow-sm shadow-slate-900/40 transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100"
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

        {/* RIGHT: empty visual placeholder for later images/video */}
        <div className="flex-1">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-md rounded-3xl border border-dashed border-slate-300 bg-white/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
            <div className="absolute inset-4 rounded-2xl border border-slate-200/80" />
            <p className="absolute inset-x-6 bottom-6 text-xs text-slate-400">
              Future: product preview / animation goes here.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
