import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

/**
 * Docked chat for Home & Library pages (bottom-right).
 * Portaled to <body> so page containers can't clip it.
 */
export default function ChatDock() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Launcher (bottom-right) */}
      <Button
        size="icon"
        variant="secondary"
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-4 md:bottom-6 right-4 md:right-6 z-[300] h-11 w-11 md:h-12 md:w-12 rounded-full shadow-md left-auto"
        data-testid="button-chat-dock"
        style={{ left: "auto", top: "auto" }}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {/* Panel sits just above the button */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat panel"
          className="
            fixed z-[280]
            right-4 md:right-6
            bottom-24 md:bottom-28
            w-[min(92vw,420px)] max-h-[70vh]
            rounded-2xl overflow-hidden shadow-2xl bg-background
            left-auto top-auto
          "
          data-testid="chat-panel-dock"
          style={{ left: "auto", top: "auto" }}
        >
          <ChatPanel />
        </div>
      )}
    </>,
    document.body
  );
}
