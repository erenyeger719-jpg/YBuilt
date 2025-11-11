// client/src/pages/Home.tsx
import { useState } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ExploreWheel from "@/components/ExploreWheel";
import ChatPanel from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";

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

      {/* Simple, premium main content */}
      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        {/* soft background wash behind sections */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
        >
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,_#eef2ff_0,_#f8fafc_45%,_transparent_100%)]" />
        </div>

        <div className="space-y-20">
          {/* SECTION 1: Why Ybuilt (very simple stripe) */}
          <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-8 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
              <div className="max-w-sm space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  WHY BUILD HERE
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  A studio that feels as simple as your notes app.
                </h2>
                <p className="text-sm text-slate-600">
                  Think of Ybuilt as a calm layer between your ideas and a real
                  product. No templates, no chaos — just a clear surface where
                  what you type becomes something you can ship.
                </p>
              </div>

              <div className="grid flex-1 gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">
                    ONE PROMPT
                  </p>
                  <p className="text-sm text-slate-700">
                    Start with a single sentence. Ybuilt turns it into a working
                    layout, flows, and structure.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">
                    FOCUSED EDITING
                  </p>
                  <p className="text-sm text-slate-700">
                    Tweak copy, blocks, and journeys in one canvas instead of
                    hunting through menus.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">
                    LAUNCH-READY
                  </p>
                  <p className="text-sm text-slate-700">
                    Share a prototype or go live directly, without exporting to
                    another tool.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Explore starting patterns (Lovable/Wix style panel) */}
          <section className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  STARTING PATTERNS
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Pick a direction, not a template.
                </h2>
                <p className="max-w-xl text-sm text-slate-600">
                  Explore different patterns for products, communities, landing
                  pages and more. Swap directions freely — your idea stays the
                  same, the shape around it evolves.
                </p>
              </div>

              <div className="text-xs text-slate-400">
                Coming soon: curated presets from the best Ybuilt projects.
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.06)]">
              <ExploreWheel />
            </div>
          </section>
        </div>
      </main>

      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
