// client/src/components/ChatDock.tsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

/**
 * Docked chat for Home & Library pages.
 * Portaled to <body> so page containers can't clip it.
 * Uses top offsets that align with the sticky header heights.
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
      {/* Launcher sits just under the sticky header (h-14/md:h-16) */}
      <Button
        size="icon"
        variant="secondary"
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed top-14 md:top-16 right-4 md:right-6 z-[300] h-10 w-10 rounded-full shadow-md"
        data-testid="button-chat-dock"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Chat panel"
          className="
            fixed z-[280]
            top-20 md:top-[88px]
            right-4 md:right-6
            bottom-4
            w-[min(92vw,420px)]
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
