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
    // pull hero further up behind the header
    <section
      className="relative overflow-hidden text-white -mt-20 pt-20"
      style={{
        background: `
          linear-gradient(
            180deg,
            #171717 0%,
            #171717 33%,
            #191919 38%,
            #1A1D22 43%,
            #242F40 48%,
            #283854 53%,
            #4262A3 58%,
            #587CC9 63%,
            #698AD5 68%,
            #8B97DE 73%,
            #C89EE1 78%,
            #D499D9 83%,
            #F27166 88%,
            #F27361 92%,
            #F16E3C 96%,
            #F16D0B 100%
          )
        `,
      }}
    >
      {/* MAIN HERO CONTAINER */}
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16 lg:pb-20">
        {/* TOP ROW: billboard text + trust copy */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-end">
          {/* Left: BUILD / SMARTER / LAUNCH / FASTER with mixed fonts */}
          <div>
            <p className="leading-[0.9] tracking-[0.03em] uppercase text-[clamp(3.4rem,7vw,5.8rem)] font-extrabold text-white">
              {/* BUILD */}
              <span className="block">
                <span className="font-blenny">BUIL</span>
                <span className="font-glodok">D</span>
              </span>

              {/* SMARTER */}
              <span className="block">
                <span className="font-glodok">SMA</span>
                <span className="font-courage">R</span>
                <span className="font-alfarn">TE</span>
                <span className="font-courage">R</span>
              </span>

              {/* LAUNCH */}
              <span className="block">
                <span className="font-courage">L</span>
                <span className="font-blenny">A</span>
                <span className="font-alfarn">UN</span>
                <span className="font-courage">C</span>
                <span className="font-glodok">H</span>
              </span>

              {/* FASTER */}
              <span className="block">
                <span className="font-courage">F</span>
                <span className="font-glodok">A</span>
                <span className="font-alfarn">S</span>
                <span className="font-courage">TER</span>
              </span>
            </p>
          </div>

          {/* Right: trust / marketing copy */}
          <div className="flex items-end lg:items-start">
            <div className="max-w-xs text-right text-[13px] leading-relaxed tracking-tight text-white/85 lg:ml-auto lg:pt-4 lg:text-left">
              <p className="mb-3 font-medium">
                A focused product studio for people who want{" "}
                <span className="font-semibold">real, working apps and sites</span>,
                not just nice-looking mockups.
              </p>
              <p className="text-white/70">
                Ybuilt gives you a single AI-assisted space to go from idea to
                live product — UI, logic, and deployment in one flow — so you
                can launch functional platforms, websites, and tools without
                needing a full engineering team.
              </p>
            </div>
          </div>
        </div>

        {/* PROMPT BAR */}
        <div className="mt-12 flex justify-center">
          <div className="w-full max-w-3xl rounded-[32px] bg-gradient-to-r from-[#6c7dff] via-[#c26bff] to-[#f28ac1] p-[2px] shadow-[0_22px_60px_rgba(15,23,42,0.5)]">
            <form onSubmit={handleCreate}>
              <div className="flex flex-col gap-4 rounded-[24px] bg-[#292929] px-8 py-7 sm:px-10 sm:py-8">
                {/* Input row */}
                <div className="flex items-center">
                  <label className="sr-only" htmlFor="hero-idea-input">
                    Describe your website or app idea
                  </label>
                  <input
                    id="hero-idea-input"
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Ask Ybuilt to create a dashboard, app, or site…"
                    className="w-full border-none bg-transparent text-sm sm:text-base text-slate-50 placeholder:text-slate-400 outline-none ring-0 focus:outline-none"
                  />
                </div>

                {/* Icons row */}
                <div className="flex items-center justify-between gap-4">
                  {/* Left cluster: + and Attach */}
                  <div className="flex items-center gap-3">
                    {/* Plus button */}
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl leading-none text-white/85 transition hover:bg-white/10"
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
                  </div>

                  {/* Right cluster: Mic and Send */}
                  <div className="flex items-center gap-3">
                    {/* Mic button */}
                    <button
                      type="button"
                      className="hidden h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/75 transition hover:bg-white/10 sm:flex"
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
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm transition hover:bg-slate-100"
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
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* STRIPES */}
        <div className="mt-12 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="relative left-1/2 w-screen -translate-x-1/2 border-t border-white/60 pt-6">
            <div className="space-y-3">
              <div className="h-[2px] bg-white" />
              <div className="h-[4px] bg-white" />
              <div className="h-[6px] bg-white" />
              <div className="h-[18px] bg-white" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
