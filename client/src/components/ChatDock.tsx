import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

/**
 * Right-edge chat for Home/Library.
 * Portaled to <body> so transforms/overflow on page sections can't clip it.
 */
export default function ChatDock() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Launcher sits just below header (h-14 md:h-16) */}
      <Button
        size="icon"
        variant="secondary"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((v) => !v)}
        className="fixed top-14 md:top-16 right-4 md:right-6 z-[200] h-10 w-10 rounded-full shadow-md"
        data-testid="button-chat-dock"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {open && (
        <div
          className="
            fixed z-[190]
            top-20 md:top-[88px] right-4 md:right-6
            w-[88vw] sm:w-[420px] max-w-[92vw]
            h-[calc(100vh-112px)] md:h-[calc(100vh-124px)]
            rounded-2xl overflow-hidden shadow-2xl bg-background
          "
          data-testid="chat-panel-dock"
        >
          <ChatPanel />
        </div>
      )}
    </>,
    document.body
  );
}
