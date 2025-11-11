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
        className="h-12 w-12 rounded-full border border-slate-500 bg-black/80 shadow-lg shadow-black/60"
        onClick={() => setIsChatOpen(!isChatOpen)}
        data-testid="button-toggle-chat"
        aria-label="Toggle chat"
      >
        {isChatOpen ? (
          <X className="h-5 w-5 text-slate-100" />
        ) : (
          <MessageCircle className="h-5 w-5 text-slate-100" />
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
          className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/70"
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
    <div className="relative min-h-screen text-slate-50">
      {/* Global Spotify/Lovable gradient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage: `
            radial-gradient(circle at top, #1ed760 0, #1ed76033 26%, transparent 55%),
            radial-gradient(circle at 10% 115%, #fb923c 0, #fb923c33 28%, transparent 60%),
            radial-gradient(circle at 90% 115%, #6366f1 0, #6366f133 28%, transparent 60%),
            radial-gradient(circle at center, #020617 0, #020617 70%)
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "150% 150%",
          backgroundPosition: "center",
        }}
      />
      {/* Global grain overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 mix-blend-soft-light"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(255,255,255,0.10)_0,rgba(255,255,255,0.10)_1px,transparent_1px,transparent_3px),repeating-linear-gradient(90deg,rgba(0,0,0,0.55)_0,rgba(0,0,0,0.55)_1px,transparent_1px,transparent_4px)",
        }}
      />

      {/* Black header stays on top */}
      <Header />

      {/* HERO takes the first viewport */}
      <Hero />

      {/* Floating rounded panel that overlaps the hero, Lovable-style */}
      <main className="relative -mt-10 pb-20 sm:-mt-12 lg:-mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-slate-700/70 bg-white text-slate-900 shadow-[0_-24px_80px_rgba(0,0,0,0.65)]">
            <div className="px-6 pb-14 pt-10 sm:px-10 lg:px-12">
              {/* SECTION: Canvas / board */}
              <section className="space-y-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Sketch ideas on a calm canvas
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      A single place where your ideas, flows, and experiments
                      live before they become real products.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <WeavyBoard />
                </div>
              </section>

              {/* SECTION: Explore starting points */}
              <section className="mt-16 space-y-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Start from a pattern that fits
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Pick a direction, not a template. Ybuilt adapts to what
                      you describe, instead of boxing you into a theme.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <ExploreWheel />
                </div>
              </section>

              {/* SECTION: Simple gallery */}
              <section className="mt-16 space-y-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      See what&apos;s possible
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      This strip will showcase live examples and shots of
                      products built with Ybuilt.
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
