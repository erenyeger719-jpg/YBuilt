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
              style={{ fontFamily: "AmericanCaptain, system-ui, sans-serif" }}
            >
              <span className="block">BUILD</span>
              <span className="block">SMARTER</span>
              <span className="block">LAUNCH</span>
              <span className="block">FASTER</span>
            </p>
          </div>

          {/* Right: trust / marketing copy */}
          <div className="flex items-end lg:items-start">
            <div className="max-w-xs text-right text-[13px] leading-relaxed tracking-tight text-neutral-800 lg:ml-auto lg:pt-4 lg:text-left">
              <p className="mb-3 font-medium">
                A focused product studio for people who want{" "}
                <span className="font-semibold">
                  real, working apps and sites
                </span>
                , not just nice-looking mockups.
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

        {/* LOVABLE-STYLE PROMPT BAR (only height adjusted) */}
        <div className="mt-16 flex justify-center">
          <div className="w-full max-w-4xl">
            {/* glow wrapper */}
            <div className="rounded-[999px] bg-transparent shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
              <form
                onSubmit={handleCreate}
                className="flex flex-col gap-4 rounded-[999px] border border-white/5 bg-[#18181b] px-8 py-7 sm:px-10 sm:py-8"
              >
                {/* main row: input + right buttons */}
                <div className="flex items-center gap-4">
                  <input
                    id="hero-idea-input"
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Ask Ybuilt to create a dashboard, app, or site…"
                    className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-400 outline-none border-none focus:outline-none"
                  />

                  {/* mic-style button (non-functional for now) */}
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#202124] text-slate-200 text-xs hover:bg-[#26272b] transition"
                  >
                    ●
                  </button>

                  {/* send button */}
                  <Button
                    type="submit"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-sm hover:bg-slate-100"
                  >
                    ↑
                  </Button>
                </div>

                {/* bottom row: + and Attach */}
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-[#202124] text-base leading-none hover:bg-[#26272b] transition"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-white/12 bg-[#202124] px-3 py-1.5 hover:bg-[#26272b] transition"
                  >
                    <span className="text-[11px] tracking-wide">Attach</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* BOTTOM: black stripes (full-page width) */}
        <div className="mt-16 w-screen relative left-1/2 right-1/2 -mx-[50vw]">
          <div className="space-y-3 border-t border-black pt-8 px-4 sm:px-10">
            <div className="h-[2px] bg-black" />
            <div className="h-[4px] bg-black" />
            <div className="h-[6px] bg-black" />
            <div className="h-[18px] bg-black" />
          </div>
        </div>
      </div>
    </section>
  );
}