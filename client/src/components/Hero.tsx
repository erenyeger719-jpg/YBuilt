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
    <section
      className="
        relative isolate 
        flex w-full flex-col justify-between 
        bg-white text-slate-900
        px-4 pt-10 pb-10
        sm:px-8 lg:px-16
        min-h-[calc(100vh-64px)]
      "
    >
      {/* Background: soft IG-ish gradient + grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        {/* soft colour wash */}
        <div className="h-full w-full bg-[radial-gradient(circle_at_top,_#fefefe_0,_#f4f4ff_35%,_#ffeef5_70%,_#fffaf1_100%)]" />

        {/* super subtle noise */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-soft-light"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(15,23,42,0.18)_0,rgba(15,23,42,0.18)_1px,transparent_1px,transparent_3px),repeating-linear-gradient(90deg,rgba(15,23,42,0.1)_0,rgba(15,23,42,0.1)_1px,transparent_1px,transparent_3px)",
          }}
        />
      </div>

      {/* Top content */}
      <div className="flex flex-1 flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
        {/* LEFT: brand intro */}
        <div className="flex-1 max-w-sm space-y-5 text-xs sm:text-sm">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
            YBUILT STUDIO
          </p>
          <p className="leading-relaxed text-slate-600">
            At Ybuilt, you&apos;re not a &quot;project&quot;. You&apos;re a
            builder. This is your calm space to turn ideas into digital reality,
            without the chaos of tools and tabs.
          </p>
          <p className="leading-relaxed text-slate-600">
            Share what&apos;s in your head in plain language — we take it from
            first sketch to something your friends can actually click.
          </p>
        </div>

        {/* RIGHT: main hero copy + prompt */}
        <div className="flex-1 space-y-6 lg:text-right">
          <div className="space-y-3">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl lg:text-6xl">
              From Idea to Digital{" "}
              <span className="block">Reality</span>
            </h1>

            <p className="text-[11px] font-semibold tracking-[0.35em] text-slate-500">
              BUILD SMARTER. LAUNCH FASTER
            </p>
          </div>

          {/* Prompt bar */}
          <div className="mt-4 inline-flex max-w-xl flex-col items-stretch rounded-2xl border border-slate-200 bg-white/80 p-3 text-left shadow-[0_18px_45px_rgba(15,23,42,0.10)] backdrop-blur-sm lg:ml-auto">
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-0 transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900/70"
              />

              <Button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-slate-50 shadow-sm shadow-slate-900/40 transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                Create
              </Button>
            </form>

            <div className="mt-3 flex items-center justify-center lg:justify-end">
              <button
                type="button"
                className="text-xs font-medium text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline"
              >
                or Explore previews →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom strip: placeholder “gallery rail” like Avision / IG */}
      <div className="mt-10 h-40 w-full rounded-3xl border border-slate-200 bg-white/70 p-3 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
        <div className="flex h-full gap-3">
          <div className="flex-1 rounded-2xl bg-slate-900/5" />
          <div className="flex-1 rounded-2xl bg-rose-400/15" />
          <div className="flex-1 rounded-2xl bg-amber-300/20" />
          <div className="flex-1 rounded-2xl bg-sky-400/20" />
          <div className="flex-1 rounded-2xl bg-emerald-400/18" />
        </div>
      </div>
    </section>
  );
}
