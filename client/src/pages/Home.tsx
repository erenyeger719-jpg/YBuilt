// client/src/pages/Home.tsx
import { useState, useEffect } from "react";           // add useEffect
import { createPortal } from "react-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import WeavyBoard from "@/components/WeavyBoard";
import ExploreWheel from "@/components/ExploreWheel";
import WorkflowToApp from "@/components/WorkflowToApp";
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
  // Avoid SSR crash: only render portal on the client
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      <Button
        size="icon"
        style={{ position: "fixed", bottom: 24, right: 24, left: "auto", zIndex: 70 }}
        className="h-14 w-14 rounded-full shadow-lg"
        onClick={() => setIsChatOpen(!isChatOpen)}
        data-testid="button-toggle-chat"
        aria-label="Toggle chat"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>

      {isChatOpen && (
        <div
          style={{ position: "fixed", bottom: 120, right: 24, left: "auto", zIndex: 60, width: 400, height: 600 }}
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />

      {/* Home — Weavy band directly under the pixel tiles */}
      <section className="weavy-section home-weavy home-weavy--prism" style={{ position: "relative", isolation: "isolate" }}>
        {/* Grid starts just below the tiles — put it BEHIND, no clicks */}
        <div
          className="grid-band"
          style={{ top: 56, height: 360, zIndex: -1, pointerEvents: "none" }}   // ⬅ behind for sure
        />
        {/* Board sits ABOVE */}
        <div className="weavy-canvas" style={{ position: "relative", zIndex: 20 }}>  {/* ⬅ above for sure */}
          <WeavyBoard />
        </div>
      </section>

      {/* New artistic sections */}
      <ExploreWheel />
      <WorkflowToApp />

      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
