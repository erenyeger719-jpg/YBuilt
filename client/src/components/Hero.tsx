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
      className="relative isolate flex min-h-[calc(100vh-56px)] items-center overflow-hidden bg-slate-50"
    >
      {/* === BACKGROUND GRADIENT LAYER - SUPER SATURATED === */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          // Super saturated, high-contrast gradient exactly matching the image
          background: `
            radial-gradient(
              ellipse at top left,
              hsla(270, 100%, 70%, 1) 0%,
              transparent 50%
            ),
            radial-gradient(
              ellipse at top right,
              hsla(300, 100%, 65%, 1) 0%,
              transparent 50%
            ),
            radial-gradient(
              ellipse at center,
              hsla(330, 100%, 70%, 1) 0%,
              transparent 40%
            ),
            radial-gradient(
              ellipse at bottom left,
              hsla(35, 100%, 60%, 1) 0%,
              transparent 50%
            ),
            radial-gradient(
              ellipse at bottom right,
              hsla(15, 100%, 55%, 1) 0%,
              transparent 50%
            ),
            linear-gradient(
              180deg,
              hsla(270, 100%, 60%, 1) 0%,
              hsla(290, 100%, 65%, 1) 10%,
              hsla(310, 100%, 70%, 1) 20%,
              hsla(330, 100%, 75%, 1) 30%,
              hsla(350, 100%, 80%, 1) 40%,
              hsla(20, 100%, 70%, 1) 50%,
              hsla(35, 100%, 60%, 1) 60%,
              hsla(25, 100%, 55%, 1) 70%,
              hsla(15, 100%, 50%, 1) 80%,
              hsla(5, 100%, 45%, 1) 90%,
              hsla(0, 100%, 40%, 1) 100%
            )
          `,
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
          filter: "saturate(1.3) contrast(1.1)",
        }}
      />

      {/* === ENHANCED GRAIN EFFECT - MORE PROMINENT === */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        {/* SVG Noise Filter for authentic strong grain */}
        <svg className="absolute h-0 w-0">
          <filter id="grainy-strong">
            <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="5" stitchTiles="stitch" seed="5"/>
            <feColorMatrix type="saturate" values="0"/>
            <feComponentTransfer>
              <feFuncA type="discrete" tableValues="0 .5 .5 .5 .5 .5 .5 .5 .5 .5 .5 .5 .5 .5 .5 .5 .5 .5 1"/>
            </feComponentTransfer>
            <feGaussianBlur stdDeviation="0.2"/>
          </filter>
        </svg>
        
        {/* Apply the stronger noise filter */}
        <div 
          className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            filter: "url(#grainy-strong)",
          }}
        />
        
        {/* Additional strong grain patterns */}
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage: `
              repeating-conic-gradient(from 0deg at 50% 50%, #000000 0deg, transparent 0.1deg, transparent 0.2deg, #000000 0.3deg)
            `,
            backgroundSize: "256px 256px",
          }}
        />
        
        {/* Heavy noise texture for pronounced grain */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-multiply"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 1px,
                rgba(0, 0, 0, 0.08) 1px,
                rgba(0, 0, 0, 0.08) 2px
              ),
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 1px,
                rgba(0, 0, 0, 0.08) 1px,
                rgba(0, 0, 0, 0.08) 2px
              ),
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 1px,
                rgba(0, 0, 0, 0.05) 1px,
                rgba(0, 0, 0, 0.05) 2px
              ),
              repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 1px,
                rgba(0, 0, 0, 0.05) 1px,
                rgba(0, 0, 0, 0.05) 2px
              )
            `,
            backgroundSize: "50px 50px, 50px 50px, 50px 50px, 50px 50px",
          }}
        />

        {/* Prominent noise dots */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 1px 1px, rgba(0,0,0,0.8) 1px, transparent 1px),
              radial-gradient(circle at 3px 3px, rgba(0,0,0,0.6) 1px, transparent 1px)
            `,
            backgroundSize: "3px 3px, 5px 5px",
            mixBlendMode: "multiply",
          }}
        />

        {/* Extra film grain simulation */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            background: `
              repeating-radial-gradient(circle at 0 0, transparent 0, rgba(0,0,0,0.1) 1px, transparent 2px, transparent 3px)
            `,
            backgroundSize: "7px 7px",
            animation: "grain 8s steps(10) infinite",
          }}
        />
        
        <style>{`
          @keyframes grain {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(-1%, -1%); }
            20% { transform: translate(1%, 0%); }
            30% { transform: translate(-1%, 1%); }
            40% { transform: translate(0%, -1%); }
            50% { transform: translate(1%, 1%); }
            60% { transform: translate(-1%, 0%); }
            70% { transform: translate(1%, -1%); }
            80% { transform: translate(0%, 1%); }
            90% { transform: translate(-1%, -1%); }
          }
        `}</style>
      </div>

      {/* === OVERLAY: keep text readable over the gradient === */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        {/* soft light wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/55 to-white/80" />
        {/* subtle vertical divider */}
        <div className="absolute inset-y-16 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-slate-200/0 via-slate-200/60 to-slate-200/0" />
        {/* fine grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-soft-light"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(15,23,42,0.2) 0,rgba(15,23,42,0.2) 1px,transparent 1px,transparent 3px),repeating-linear-gradient(90deg,rgba(15,23,42,0.12) 0,rgba(15,23,42,0.12) 1px,transparent 1px,transparent 3px)",
          }}
        />
      </div>

      {/* === FOREGROUND CONTENT === */}
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 md:flex-row md:items-center md:py-16">
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

        {/* RIGHT: placeholder block for now (could be removed later if you want pure center hero) */}
        <div className="flex-1">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-md rounded-3xl border border-dashed border-slate-300 bg-white/60 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
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