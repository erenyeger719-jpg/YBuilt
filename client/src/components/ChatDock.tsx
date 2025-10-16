import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

export default function ChatDock() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Launcher sits under the header, near the right edge */}
      <Button
        size="icon"
        variant="secondary"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen(v => !v)}
        className="fixed top-24 right-4 z-[120] h-10 w-10 rounded-full shadow-md"
        data-testid="button-chat-dock"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {/* Slide-in panel */}
      {open && (
        <div
          className="fixed z-[110] top-20 right-4 w-[88vw] sm:w-[420px] max-w-[90vw] h-[calc(100vh-6rem)] rounded-2xl overflow-hidden shadow-2xl"
          data-testid="chat-panel-dock"
        >
          <ChatPanel />
        </div>
      )}
    </>
  );
}
