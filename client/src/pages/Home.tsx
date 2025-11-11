// client/src/pages/Home.tsx
import { useState } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import WeavyBoard from "@/components/WeavyBoard";
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
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          left: "auto",
          zIndex: 70,
        }}
        className="h-12 w-12 rounded-full border border-slate-300 bg-white shadow-lg shadow-slate-400/40"
        onClick={() => setIsChatOpen(!isChatOpen)}
        data-testid="button-toggle-chat"
        aria-label="Toggle chat"
      >
        {isChatOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </Button>

      {isChatOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 110,
            right: 24,
            left: "auto",
            zIndex: 60,
            width: 400,
            height: 560,
          }}
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
      className="relative min-h-screen text-slate-50"
      style={{
        // Minimal Colors – Purple 90’s gradient around the edges on a dark base
        background:
          "radial-gradient(circle at 0% 0%, #a0d2eb 0, rgba(160,210,235,0) 40%)," +
          "radial-gradient(circle at 100% 0%, #e5eaf5 0, rgba(229,234,245,0) 45%)," +
          "radial-gradient(circle at 0% 100%, #d0bdf4 0, rgba(208,189,244,0) 45%)," +
          "radial-gradient(circle at 100% 100%, #8458B3 0, rgba(132,88,179,0) 50%)," +
          "#1F1E21",
      }}
    >
      {/* Global grain/texture overlay (Instagram-ish) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.20] mix-blend-soft-light"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)," +
            "repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0, rgba(0,0,0,0.25) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Header stays as-is on top */}
      <Header />

      {/* Hero (already using your hero-img.jpg background) */}
      <Hero />

      {/* Floating rounded panel that overlaps the hero, like Lovable */}
      <main className="relative -mt-10 pb-20 sm:-mt-12 lg:-mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#1F1E21]/90 shadow-[0_-24px_80px_rgba(0,0,0,0.75)] backdrop-blur-md">
            {/* inner padding for content */}
            <div className="px-6 pb-14 pt-10 sm:px-10 lg:px-12">
              {/* SECTION: Canvas / board */}
              <section className="space-y-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Sketch ideas on a calm canvas
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      A single place where your ideas, flows, and experiments
                      live before they become real products.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#26252F] shadow-sm">
                  <WeavyBoard />
                </div>
              </section>

              {/* SECTION: Explore starting points */}
              <section className="mt-16 space-y-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Start from a pattern that fits
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      Pick a direction, not a template. Ybuilt adapts to what
                      you describe, instead of boxing you into a theme.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#26252F] shadow-sm">
                  <ExploreWheel />
                </div>
              </section>

              {/* SECTION: Simple gallery */}
              <section className="mt-16 space-y-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      See what&apos;s possible
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      This strip will showcase live examples and shots of
                      products built with Ybuilt.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#26252F] shadow-sm">
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
