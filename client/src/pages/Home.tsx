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
    <section className="relative isolate flex min-h-[calc(100vh-64px)] items-center bg-[#f5f4f2] px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      {/* Background halo + super subtle texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        {/* soft spotlight behind hero */}
        <div className="absolute inset-x-0 top-20 mx-auto h-80 max-w-4xl rounded-full bg-[radial-gradient(circle,#ffffff_0,#f0ebe4_55%,transparent_80%)] opacity-95 blur-3xl" />
        {/* faint vertical divider hint */}
        <div className="absolute inset-y-16 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-slate-200/0 via-slate-200/60 to-slate-200/0" />
        {/* micro grain so it doesn’t look flat */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-soft-light"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(15,23,42,0.2)_0,rgba(15,23,42,0.2)_1px,transparent_1px,transparent_3px),repeating-linear-gradient(90deg,rgba(15,23,42,0.12)_0,rgba(15,23,42,0.12)_1px,transparent_1px,transparent_3px)",
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        {/* Label */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-slate-500 shadow-sm shadow-slate-900/5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
          <span>YBUILT • BUILDER STUDIO</span>
        </div>

        {/* Main card with headline */}
        <div className="rounded-[32px] border border-slate-200/90 bg-gradient-to-b from-white to-[#f4ede3] px-8 py-10 shadow-[0_24px_60px_rgba(15,23,42,0.16)] sm:px-10 sm:py-12">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-[2.8rem] md:leading-tight">
            From Idea to Digital{" "}
            <span className="block">Reality</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="mt-7 text-[11px] font-semibold tracking-[0.35em] text-slate-500">
          BUILD SMARTER. LAUNCH FASTER
        </p>

        {/* Command surface: prompt + button */}
        <div className="mt-9 w-full max-w-2xl rounded-[999px] border border-slate-200/90 bg-white/90 px-3 py-2 shadow-[0_22px_55px_rgba(15,23,42,0.16)] backdrop-blur-sm">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
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
              className="w-full rounded-[999px] border border-transparent bg-slate-50/70 px-5 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-0 transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900/70"
            />

            <Button
              type="submit"
              className="mt-1 inline-flex shrink-0 items-center justify-center rounded-[999px] bg-slate-900 px-6 py-3 text-sm font-medium text-slate-50 shadow-[0_14px_32px_rgba(15,23,42,0.45)] transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white/40 sm:mt-0"
            >
              Create
            </Button>
          </form>
        </div>

        {/* Secondary link */}
        <button
          type="button"
          className="mt-4 text-xs font-medium text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline"
        >
          or Explore previews →
        </button>
      </div>
    </section>
  );
}
