import { useState } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";
import ChatPanel from "@/components/ChatPanel";
import TerminalPanel from "@/components/TerminalPanel";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Code2 } from "lucide-react";

function FloatingUI({
  isChatOpen,
  setIsChatOpen,
  isTerminalOpen,
  setIsTerminalOpen,
}: {
  isChatOpen: boolean;
  setIsChatOpen: (v: boolean) => void;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (v: boolean) => void;
}) {
  return createPortal(
    <>
      {/* Terminal toggle — bottom-left */}
      <Button
        size="icon"
        style={{
          position: "fixed",
          bottom: 24,
          left: 24,
          right: "auto",
          zIndex: 70,
        }}
        className="h-14 w-14 rounded-full shadow-lg"
        onClick={() => setIsTerminalOpen(!isTerminalOpen)}
        data-testid="button-toggle-terminal"
        aria-label="Toggle terminal"
      >
        {isTerminalOpen ? <X className="w-6 h-6" /> : <Code2 className="w-6 h-6" />}
      </Button>

      {/* Chat toggle — bottom-right (force left:auto so nothing overrides it) */}
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
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>

      {/* Panels — anchored away from toggles */}
      {isTerminalOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 120,
            left: 24,
            zIndex: 60,
            width: 600,
            height: 700,
          }}
          className="shadow-2xl"
          data-testid="terminal-panel-container"
        >
          <TerminalPanel />
        </div>
      )}

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

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Showcase />

      <FloatingUI
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        isTerminalOpen={isTerminalOpen}
        setIsTerminalOpen={setIsTerminalOpen}
      />
    </div>
  );
}
