// client/src/pages/Home.tsx
import { useState } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ExploreWheel from "@/components/ExploreWheel";
import ChatPanel from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ScrollGallery from "@/components/ScrollGallery";

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
        style={{ position: "fixed", bottom: 24, right: 24, left: "auto", zIndex: 70 }}
        className="h-12 w-12 rounded-full border border-slate-300 bg-white shadow-lg shadow-slate-400/40"
        onClick={() => setIsChatOpen(!isChatOpen)}
        data-testid="button-toggle-chat"
        aria-label="Toggle chat"
      >
        {isChatOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {isChatOpen && (
        <div
          style={{ position: "fixed", bottom: 110, right: 24, left: "auto", zIndex: 60, width: 400, height: 560 }}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
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

  return (
    <div
      className="relative min-h-screen text-slate-900"
      style={{
        background:
          "linear-gradient(to bottom, #a0d2eb 0%, #e5eaf5 28%, #d0bdf4 40%, #8458B3 56%, #1F1E21 78%, #1F1E21 100%)",
      }}
    >
      {/* global grain / noise */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.25] mix-blend-soft-light"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)," +
            "repeating-linear-gradient(90deg, rgba(0,0,0,0.22) 0, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)",
        }}
      />

      <Header />
      <Hero />

      {/* Overlapping content panel with requested gradient */}
      <main className="relative -mt-10 pb-20 sm:-mt-12 lg:-mt-16">
        <div className="mx-auto" style={{ width: "min(1680px, calc(100vw - 48px))" }}>
          <div
            className="overflow-hidden rounded-[28px] md:rounded-[32px] border border-slate-200 shadow-[0_-24px_80px_rgba(15,23,42,0.20)]"
            style={{
              /* Rules:
                 - 0–22.22%  : solid White (#FFFFFF) → upper 1/3 of remaining 2/3
                 - 22–66.67% : blend Freeze Purple → Medium Purple → Purple Pain (in order)
                 - 66.67–100%: solid Heavy Purple (#1F1E21) → last 1/3
              */
              background: `
                linear-gradient(
                  180deg,
                  #FFFFFF 0%,
                  #FFFFFF 22.22%,

                  /* middle blend, keep order */
                  #e5eaf5 30%,
                  #d0bdf4 45%,
                  #8458B3 60%,

                  /* final third = heavy purple slab */
                  #1F1E21 66.67%,
                  #1F1E21 100%
                )
              `,
            }}
          >
            <div className="px-4 sm:px-8 lg:px-12 pb-14 pt-10">
              {/* SECTION: Explore starting points */}
              <section className="space-y-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Start from a pattern that fits</h2>
                    <p className="mt-1 text-sm text-slate-800/80">
                      Pick a direction, not a template. Ybuilt adapts to what you describe, instead of boxing you into a
                      theme.
                    </p>
                  </div>
                </div>

                {/* Keep inner cards white for readability */}
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <ExploreWheel />
                </div>
              </section>

              {/* SECTION: Simple gallery */}
              <section className="mt-16 space-y-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">See what&apos;s possible</h2>
                    <p className="mt-1 text-sm text-slate-800/80">
                      This strip will showcase live examples and shots of products built with Ybuilt.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
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
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
