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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Keep your existing black header as the “frame” */}
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        {/* HERO */}
        <Hero />

        {/* SECTION: Canvas / board */}
        <section className="mt-16 space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Sketch ideas on a calm canvas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                A single place where your ideas, flows, and experiments live
                before they become real products.
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
                Pick a direction, not a template. Ybuilt adapts to what you
                describe, instead of boxing you into a theme.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <ExploreWheel />
          </div>
        </section>

        {/* SECTION: Simple gallery with placeholder images for now */}
        <section className="mt-16 space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                See what&apos;s possible
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                This strip will showcase live examples and shots of products
                built with Ybuilt.
              </p>
            </div>
          </div>

          {/* If you want zero actual images for now, you can comment ScrollGallery out
              and leave the placeholder below. */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <ScrollGallery
              images={[
                // temporary placeholders — swap with real images later
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
      </main>

      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
