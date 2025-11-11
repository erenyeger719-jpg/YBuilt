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
      className="relative flex min-h-[calc(100vh-56px)] items-center justify-center overflow-hidden"
    >
      {/* === BACKGROUND IMAGE LAYER === */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url('/hero-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* === VERY SUBTLE OVERLAY - barely visible to keep colors vibrant === */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        {/* Very subtle gradient for just a touch of readability without dulling the image */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/20" />
      </div>

      {/* === CENTERED CONTENT === */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          
          {/* Badge */}
          <div className="mb-8">
            <p className="inline-flex items-center rounded-full border border-slate-300/50 bg-white/80 backdrop-blur-sm px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
              Build studio · Ybuilt
            </p>
          </div>

          {/* Main heading */}
          <div className="mb-4">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
              From your Idea to{" "}
              <span className="block">Reality</span>
            </h1>
          </div>

          {/* Subheading */}
          <div className="mb-6">
            <p className="text-sm font-semibold tracking-[0.35em] text-slate-600 sm:text-[13px]">
              BUILD SMARTER. LAUNCH FASTER
            </p>
          </div>

          {/* Description */}
          <div className="mb-10 max-w-2xl">
            <p className="text-base text-slate-700 sm:text-lg">
              Describe what you want to ship. Ybuilt turns it into a working
              product, then lets you refine it without drowning in settings.
            </p>
          </div>

          {/* Prompt surface - centered */}
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200/50 bg-white/85 backdrop-blur-sm p-4 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
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
                className="w-full rounded-xl border border-slate-200/60 bg-white/80 px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-0 transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-400/30"
              />

              <Button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
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

          {/* Optional: placeholder for future content */}
          <div className="mt-12 text-xs text-slate-400">
            Future: product preview / animation goes here
          </div>
        </div>
      </div>
    </section>
  );
}