// client/src/pages/Home.tsx
import { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";
import ChatPanel from "@/components/ChatPanel";
import TerminalPanel from "@/components/TerminalPanel";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Code2 } from "lucide-react";

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Showcase />

      {/* Terminal Toggle - fixed bottom-left */}
      <Button
        size="icon"
        className="fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg z-[70]"
        onClick={() => setIsTerminalOpen((v) => !v)}
        data-testid="button-toggle-terminal"
        aria-label="Toggle terminal"
      >
        {isTerminalOpen ? <X className="w-6 h-6" /> : <Code2 className="w-6 h-6" />}
      </Button>

      {/* Chat Toggle - fixed bottom-right */}
      <Button
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-[70]"
        onClick={() => setIsChatOpen((v) => !v)}
        data-testid="button-toggle-chat"
        aria-label="Toggle chat"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>

      {/* Terminal Panel */}
      {isTerminalOpen && (
        <div
          className="fixed bottom-24 left-6 w-[600px] h-[700px] z-[60] shadow-2xl"
          data-testid="terminal-panel-container"
        >
          <TerminalPanel />
        </div>
      )}

      {/* Chat Panel */}
      {isChatOpen && (
        <div
          className="fixed bottom-24 right-6 w-[400px] h-[600px] z-[60] shadow-2xl"
          data-testid="chat-panel-container"
        >
          <ChatPanel />
        </div>
      )}
    </div>
  );
}
