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
        className="h-14 w-14 rounded-full shadow-lg"
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

  return (
    <div className="min-h-screen bg-[#050509] text-slate-100">
      {/* Original header: keeps your exact nav copy & layout */}
      <Header />

      {/* New charcoal hero with original title + tagline */}
      <Hero />

      {/* Weavy band */}
      <section className="weavy-section home-weavy home-weavy--prism">
        <div className="grid-band" style={{ top: 56, height: 360 }} />
        <div className="weavy-canvas">
          <WeavyBoard />
        </div>
      </section>

      {/* Explore wheel */}
      <ExploreWheel />

      {/* Scroll gallery */}
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

      {/* Floating chat */}
      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
