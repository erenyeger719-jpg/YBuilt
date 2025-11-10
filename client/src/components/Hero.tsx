// client/src/components/Hero.tsx
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function HomeHero() {
  const { toast } = useToast();
  const [promptText, setPromptText] = useState("");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const prompt = promptText.trim();
    if (!prompt) return;

    try {
      console.log("[home-hero] starting fetch → /api/generate", { prompt });

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

      console.log("[home-hero] status:", r.status, "data:", data);

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
      console.log("[home-hero] redirect →", target);
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
      console.error("[home-hero] error:", err);
      toast({
        title: "Create failed",
        description: err?.message || "Request failed",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-16 -z-10 flex justify-center"
      >
        <div className="h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl sm:h-96 sm:w-96" />
      </div>

      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800/80 shadow-sm shadow-slate-900/60">
              <span className="text-xs font-semibold tracking-tight text-emerald-300">
                Y
              </span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-100">
              Ybuilt
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-6 text-xs sm:text-sm">
            <div className="hidden items-center gap-6 md:flex">
              <button className="transition-colors hover:text-slate-50">
                Library
              </button>
              <button className="transition-colors hover:text-slate-50">
                Team
              </button>
              <button className="transition-colors hover:text-slate-50">
                Invite
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button className="hidden rounded-full border border-slate-700/80 px-3 py-1 text-xs font-medium text-slate-200 shadow-sm shadow-slate-900/60 transition-colors hover:border-slate-500/80 md:inline-flex">
                Creator plan · ₹799
              </button>

              <div className="hidden items-center gap-2 sm:flex">
                <span className="rounded-full border border-slate-700/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-300">
                  INR
                </span>

                <button className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/80 text-[11px] font-medium text-slate-200 shadow-sm shadow-slate-900/60">
                  {/* Avatar placeholder; can be replaced by real user avatar */}
                  Y
                </button>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <section className="w-full max-w-3xl text-center">
          {/* Small label */}
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/80">
            Builder studio
          </p>

          {/* Headline */}
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl md:text-5xl">
            Your builder that doesn&apos;t shout.
          </h1>

          {/* Subheadline */}
          <p className="mt-4 text-sm text-slate-300 sm:text-base">
            Share your idea in plain words; Ybuilt turns it into a live
            website or app, quietly and precisely.
          </p>

          {/* Command surface */}
          <div className="mt-8 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/60 sm:p-5">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
              onSubmit={handleCreate}
            >
              <label className="sr-only" htmlFor="idea-input">
                Describe your website or app idea
              </label>

              <input
                id="idea-input"
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Describe what you’d like to build…"
                className="w-full rounded-xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-0 transition focus:border-transparent focus:ring-2 focus:ring-emerald-400/70 sm:text-base"
              />

              <Button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-400 px-5 py-3 text-sm font-medium text-slate-950 shadow-sm shadow-emerald-400/40 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Begin
              </Button>
            </form>

            {/* Secondary action */}
            <div className="mt-3 flex items-center justify-center">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-100"
              >
                <span>Or explore previews</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
