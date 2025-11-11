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
      {/* Fixed black header frame */}
      <Header />

      {/* HERO owns the first viewport */}
      <Hero />

      {/* Main content: soft gradient, editorial spacing */}
      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        {/* subtle background wash behind all sections */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
        >
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,_#eef2ff_0,_#f8fafc_45%,_transparent_100%)]" />
        </div>

        <div className="space-y-20">
          {/* OVERVIEW STRIP — small “Wix-ish” trust / meta row */}
          <section className="grid gap-6 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                HOW IT WORKS
              </p>
              <p className="text-sm text-slate-700">
                Describe what you want to build in one sentence. Ybuilt spins up
                a working starting point in minutes.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                BUILDER EXPERIENCE
              </p>
              <p className="text-sm text-slate-700">
                Edit flows, copy, and layout in a focused canvas instead of
                digging through menus and panels.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                LAUNCH READY
              </p>
              <p className="text-sm text-slate-700">
                Ship a shareable prototype or live site without ever leaving
                this workspace.
              </p>
            </div>
          </section>

          {/* SECTION: Canvas / board */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  WORKSPACE
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Sketch ideas on a calm canvas
                </h2>
                <p className="max-w-xl text-sm text-slate-500">
                  Keep copy, flows, and structure in one place. Drag things
                  around, try variants, and decide what actually deserves to go
                  live.
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Built for founder notes, screenshots, napkin sketches, and
                “what if we…” threads.
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
              <WeavyBoard />
            </div>
          </section>

          {/* SECTION: Explore starting points */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  STARTING POINTS
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Start from a pattern that fits you
                </h2>
                <p className="max-w-xl text-sm text-slate-500">
                  Pick a direction, not a rigid template. Ybuilt listens to your
                  prompt and suggests structures that feel right for products,
                  newsletters, communities, and more.
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Swap patterns anytime — your content and intent stay with you.
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.06)]">
              <ExploreWheel />
            </div>
          </section>

          {/* SECTION: Simple gallery / showcase */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  SHOWCASE
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  See what&apos;s possible with Ybuilt
                </h2>
                <p className="max-w-xl text-sm text-slate-500">
                  A rotating strip of real projects, experiments, and layouts
                  built with the same prompt surface you see above.
                </p>
              </div>
              <p className="text-xs text-slate-400">
                These will eventually be live links to your community&apos;s
                best work.
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-900">
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
      </main>

      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
