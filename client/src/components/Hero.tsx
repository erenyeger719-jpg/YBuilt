// client/src/components/Hero.tsx
import { useState, FormEvent } from "react";
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
      {/* MAIN HERO CONTAINER */}
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16 lg:pb-20">
        {/* TOP ROW: billboard text + trust copy */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-end">
          {/* Left: BUILD SMARTER LAUNCH FASTER */}
          <div>
            <p
              className="leading-[0.8] tracking-[0.03em] uppercase text-[clamp(3.4rem,7vw,5.8rem)] font-extrabold"
              style={{ fontFamily: '"AmericanCaptain", system-ui, sans-serif' }}
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

        {/* PROMPT BAR — same style, just taller */}
        <div className="mt-12 flex justify-center">
          <div className="w-full max-w-4xl rounded-[48px] bg-gradient-to-r from-[#6c7dff] via-[#c26bff] to-[#f28ac1] p-[2px] shadow-[0_22px_60px_rgba(15,23,42,0.5)]">
            <form onSubmit={handleCreate}>
              <div className="flex items-center gap-4 rounded-[44px] bg-[#292929] px-8 py-8 sm:px-10 sm:py-8">
                {/* Left: plus button */}
                <button
                  type="button"
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl leading-none text-white/85 transition hover:bg-white/10"
                >
                  +
                </button>

                {/* Attach pill (hidden on very small screens) */}
                <button
                  type="button"
                  className="hidden items-center gap-2 rounded-full border border-white/14 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 sm:inline-flex"
                >
                  <span className="inline-block h-[14px] w-[14px] rounded-[3px] border border-white/40" />
                  <span>Attach</span>
                </button>

                {/* Input */}
                <label className="sr-only" htmlFor="hero-idea-input">
                  Describe your website or app idea
                </label>
                <input
                  id="hero-idea-input"
                  type="text"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Ask Ybuilt to create a dashboard, app, or site…"
                  className="flex-1 border-none bg-transparent text-sm sm:text-base text-slate-50 placeholder:text-slate-400 outline-none ring-0 focus:outline-none"
                />

                {/* Mic button */}
                <button
                  type="button"
                  className="hidden h-14 w-14 items-center justify-center rounded-full bg-white/5 text-white/75 transition hover:bg-white/10 sm:flex"
                >
                  <span className="sr-only">Record voice prompt</span>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                  >
                    <path
                      d="M12 3a3 3 0 0 0-3 3v4a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Z"
                      fill="currentColor"
                    />
                    <path
                      d="M7 11a1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11a1 1 0 1 0-2 0 5 5 0 1 1-10 0Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>

                {/* Send button (submit) */}
                <button
                  type="submit"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm transition hover:bg-slate-100"
                >
                  <span className="sr-only">Send</span>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                  >
                    <path
                      d="M5 12h8.586l-3.293 3.293a1 1 0 1 0 1.414 1.414l5-5a1 1 0 0 0 0-1.414l-5-5a1 1 0 0 0-1.414 1.414L13.586 11H5a1 1 0 1 0 0 2Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* BLACK STRIPES — unchanged */}
        <div className="mt-12 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="relative left-1/2 w-screen -translate-x-1/2 border-t border-black/80 pt-6">
            <div className="space-y-3">
              <div className="h-[2px] bg-black" />
              <div className="h-[4px] bg-black" />
              <div className="h-[6px] bg-black" />
              <div className="h-[18px] bg-black" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}