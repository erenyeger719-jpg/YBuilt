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
        relative 
        flex w-full flex-col 
        min-h-[calc(100vh-64px)]
        text-slate-900
        overflow-hidden
      "
    >
      {/* background image */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: 'url("/hero-bg.jpg")' }}
      />
      {/* soft white wash on top so text stays readable */}
      <div className="absolute inset-0 -z-10 bg-white/82 backdrop-blur-[1px]" />

      {/* TOP ROW: Avision-style layout */}
      <div className="flex flex-1 flex-col justify-end gap-12 px-6 pt-16 pb-10 sm:px-10 lg:flex-row lg:items-end lg:px-24">
        {/* LEFT: studio intro */}
        <div className="max-w-xs text-[11px] leading-relaxed tracking-[0.08em] text-slate-800">
          <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-600">
            YBUILT STUDIO
          </p>
          <p>
            AT YBUILT, WE&apos;RE MORE THAN JUST A BUILDER; WE&apos;RE A QUIET
            PARTNER DEDICATED TO EMPOWERING DIGITAL TALENT.
          </p>
          <p className="mt-3">
            WE HELP YOU GO FROM FIRST SPARK TO SOMETHING PEOPLE CAN ACTUALLY
            CLICK — WITHOUT THE NOISE.
          </p>
        </div>

        {/* RIGHT: big heading + tagline + minimal prompt bar */}
        <div className="pb-2 text-right lg:pb-6">
          <div className="space-y-1">
            <h1 className="text-[32px] font-medium leading-none tracking-[0.12em] text-slate-900 sm:text-[40px] md:text-[52px] lg:text-[64px]">
              FROM IDEA
            </h1>
            <h1 className="text-[32px] font-medium leading-none tracking-[0.12em] text-slate-900 sm:text-[40px] md:text-[52px] lg:text-[64px]">
              TO DIGITAL
            </h1>
            <h1 className="text-[32px] font-medium leading-none tracking-[0.12em] text-slate-900 sm:text-[40px] md:text-[52px] lg:text-[64px]">
              REALITY
            </h1>
          </div>

          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-600">
            BUILD SMARTER · LAUNCH FASTER
          </p>

          {/* Minimal prompt bar */}
          <form
            onSubmit={handleCreate}
            className="mt-8 inline-flex items-center gap-4 border-b border-slate-900/25 pb-2 text-left lg:ml-auto"
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
              className="w-56 bg-transparent text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none sm:w-72 sm:text-sm"
            />
            <Button
              type="submit"
              className="rounded-full border border-slate-900 bg-slate-900 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-black"
            >
              Create
            </Button>
          </form>
        </div>
      </div>

      {/* BOTTOM IMAGE STRIP — placeholder rail */}
      <div className="mt-4 h-[260px] w-full overflow-hidden">
        <div className="grid h-full w-full grid-cols-5 gap-[2px]">
          {/* Replace with real images later */}
          <div className="bg-[linear-gradient(135deg,#f97316,#fed7aa)]" />
          <div className="bg-[linear-gradient(135deg,#e11d48,#fecaca)]" />
          <div className="bg-[linear-gradient(135deg,#0ea5e9,#bfdbfe)]" />
          <div className="bg-[linear-gradient(135deg,#22c55e,#bbf7d0)]" />
          <div className="bg-[linear-gradient(135deg,#111827,#38bdf8)]" />
        </div>
      </div>
    </section>
  );
}
