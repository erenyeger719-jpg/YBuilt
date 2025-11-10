// client/src/pages/Home.tsx
import { useState } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/Header";
import WeavyBoard from "@/components/WeavyBoard";
import ExploreWheel from "@/components/ExploreWheel";
import ChatPanel from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ScrollGallery from "@/components/ScrollGallery";
import { useToast } from "@/hooks/use-toast";

/* ========= Floating chat ========= */
function FloatingChat({
  isChatOpen,
  setIsChatOpen,
}: {
  isChatOpen: boolean;
  setIsChatOpen: (v: boolean) => void;
}) {
  return createPortal(
    <>
      <Button
        size="icon"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          left: "auto",
          zIndex: 70,
        }}
        className="h-14 w-14 rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/40 hover:bg-emerald-300"
        onClick={() => setIsChatOpen(!isChatOpen)}
        data-testid="button-toggle-chat"
        aria-label="Toggle chat"
      >
        {isChatOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {isChatOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 120,
            right: 24,
            left: "auto",
            zIndex: 60,
            width: 400,
            height: 600,
          }}
          className="shadow-2xl"
          data-testid="chat-panel-container"
        >
          <ChatPanel />
        </div>
      )}
    </>,
    document.body
  );
}

/* ========= Page ========= */
export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const { toast } = useToast();

  async function handleCreate(rawText: string) {
    const prompt = rawText.trim();
    if (!prompt) return;

    try {
      console.log("[create] starting fetch → /api/generate", { prompt });
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

      console.log("[create] status:", r.status, "data:", data);

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
      console.log("[create] redirect →", target);
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
      console.error("[create] error:", err);
      toast({
        title: "Create failed",
        description: err?.message || "Request failed",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        {/* Soft radial light behind hero */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-24 -z-10 flex justify-center"
        >
          <div className="h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl sm:h-96 sm:w-96" />
        </div>

        {/* Hero section */}
        <section className="flex flex-col items-center text-center">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/80">
            Calm builder studio
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl md:text-5xl">
            A quiet place for your ideas.
          </h1>

          <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
            Sit down, breathe, and tell Ybuilt what you want to create. It turns
            your words into a working site or app, while you stay in the calm.
          </p>

          <div className="mt-8 w-full max-w-3xl rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/60 sm:p-5">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreate(promptText);
              }}
            >
              <label className="sr-only" htmlFor="home-idea-input">
                Describe your website or app idea
              </label>
              <input
                id="home-idea-input"
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Describe what you’d like to build today…"
                className="w-full rounded-xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-0 transition focus:border-transparent focus:ring-2 focus:ring-emerald-400/70 sm:text-base"
              />
              <Button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-400 px-5 py-3 text-sm font-medium text-slate-950 shadow-sm shadow-emerald-400/40 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Begin
              </Button>
            </form>

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

        {/* Weavy band */}
        <section className="weavy-section home-weavy home-weavy--prism mt-20">
          <div className="grid-band" style={{ top: 56, height: 360 }} />
          <div className="weavy-canvas">
            <WeavyBoard />
          </div>
        </section>

        {/* Explore wheel */}
        <section className="mt-16">
          <ExploreWheel />
        </section>

        {/* Scroll gallery */}
        <section className="mt-16">
          <ScrollGallery
            images={[
              "/demo/ybuilt-01.jpg",
              "/demo/ybuilt-02.jpg",
              "/demo/ybuilt-03.jpg",
              "/demo/ybuilt-04.jpg",
              "/demo/ybuilt-05.jpg",
              "/demo/ybuilt-06.jpg",
              "/demo/ybuilt-07.jpg",
              "/demo/ybuilt-08.jpg",
            ]}
          />
        </section>
      </main>

      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
