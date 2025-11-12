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
    <section className="relative overflow-hidden bg-white text-black">
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col justify-between px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* TOP ROW: billboard text + trust copy */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-end">
          {/* Left: BUILD SMARTER LAUNCH FASTER */}
          <div>
            <p
              className="leading-[0.8] tracking-tight uppercase text-[clamp(2.8rem,5.6vw,4.6rem)] font-extrabold"
              style={{ fontFamily: "Barrbar, system-ui, sans-serif" }}
            >
              <span className="block">BUILD</span>
              <span className="block">SMARTER</span>
              <span className="block">LAUNCH FASTER</span>
            </p>
          </div>

          {/* Right: trust / marketing copy */}
          <div className="flex items-end lg:items-start">
            <div className="max-w-xs text-right text-[13px] leading-relaxed tracking-tight text-neutral-800 lg:ml-auto lg:pt-4 lg:text-left">
              <p className="mb-3 font-medium">
                A focused product studio for people who want{" "}
                <span className="font-semibold">real, working apps and sites</span>,
                not just nice-looking mockups.
              </p>
              <p className="text-neutral-600">
                Ybuilt gives you a single AI-assisted space to go from idea to
                live product — UI, logic, and deployment in one flow — so you
                can launch functional platforms, websites, and tools without
                needing a full engineering team.
              </p>
            </div>
          </div>
        </div>

        {/* MIDDLE: video slot (centered, like the reference hero) */}
        <div className="mt-10 flex justify-center">
          <div className="aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-2xl bg-black shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
            {/* Put your <video> or iframe here later */}
          </div>
        </div>

        {/* PROMPT BAR (kept, just centered under the video) */}
        <div className="mt-10 flex justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200/50 bg-white/85 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.08)] backdrop-blur-sm">
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
        </div>

        {/* BOTTOM: black stripes + red wavy line */}
        <div className="mt-12 w-full">
          <div className="space-y-2 border-t border-black pt-6">
            <div className="h-[2px] bg-black" />
            <div className="h-[2px] bg-black" />
            <div className="h-[2px] bg-black" />
            <div className="h-[10px] bg-black" />
          </div>

          <div className="relative mt-4 h-16 overflow-hidden">
            <svg
              viewBox="0 0 800 80"
              className="absolute inset-0 h-full w-full"
            >
              <path
                d="
                  M 0 40
                  Q 50 0   100 40
                  T 200 40
                  T 300 40
                  T 400 40
                  T 500 40
                  T 600 40
                  T 700 40
                  T 800 40
                "
                fill="none"
                stroke="#e24b2f"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}