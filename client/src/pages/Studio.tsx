import { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";
import ChatPanel from "@/components/ChatPanel";
import TerminalPanel from "@/components/TerminalPanel";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Code2 } from "lucide-react";

export default function Studio() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky global header */}
      <Header />

      {/* Main content */}
      <main className="pt-0">
        <Hero />
        <Showcase />
      </main>

      {/* ---------- Floating Action Buttons (responsive) ---------- */}
      {/* Terminal Toggle */}
      <Button
        size="icon"
        className="fixed bottom-4 sm:bottom-6 left-4 sm:left-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg z-50"
        onClick={() => setIsTerminalOpen((v) => !v)}
        data-testid="button-toggle-terminal"
        aria-label={isTerminalOpen ? "Close terminal" : "Open terminal"}
        aria-expanded={isTerminalOpen}
        aria-controls="terminal-panel"
      >
        {isTerminalOpen ? <X className="w-6 h-6" /> : <Code2 className="w-6 h-6" />}
      </Button>

      {/* Chat Toggle */}
      <Button
        size="icon"
        className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg z-50"
        onClick={() => setIsChatOpen((v) => !v)}
        data-testid="button-toggle-chat"
        aria-label={isChatOpen ? "Close chat" : "Open chat"}
        aria-expanded={isChatOpen}
        aria-controls="chat-panel"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>

      {/* ---------- Panels (responsive sizing & placement) ---------- */}
      {/* Terminal Panel */}
      {isTerminalOpen && (
        <div
          id="terminal-panel"
          className="
            fixed z-40 shadow-2xl overflow-hidden rounded-2xl
            bottom-24 sm:bottom-24
            left-1/2 -translate-x-1/2 sm:left-6 sm:translate-x-0
            w-[92vw] max-w-[920px] sm:w-[600px]
            h-[70vh] sm:h-[700px]
          "
          data-testid="terminal-panel-container"
        >
          <TerminalPanel />
        </div>
      )}

      {/* Chat Panel */}
      {isChatOpen && (
        <div
          id="chat-panel"
          className="
            fixed z-40 shadow-2xl overflow-hidden rounded-2xl
            bottom-24 sm:bottom-24
            right-4 sm:right-6
            w-[88vw] max-w-[420px]
            h-[60vh] sm:h-[600px]
          "
          data-testid="chat-panel-container"
        >
          <ChatPanel />
        </div>
      )}
    </div>
  );
}
