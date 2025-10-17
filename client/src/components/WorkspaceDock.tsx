import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

/**
 * Workspace-only chat dock.
 * Bottom-right FAB + panel. No console overlay here (console lives in the right tab).
 * Z-order follows our ladder: FAB 300, panel 280.
 */
export default function WorkspaceDock() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Round chat button (bottom-right) */}
      <Button
        size="icon"
        variant="secondary"
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-4 right-4 md:bottom-5 md:right-6 z-[300] h-12 w-12 rounded-full shadow-md"
        data-testid="button-chat-workspace"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {/* Chat panel (bottom-right) */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat panel"
          className="
            fixed z-[280]
            right-4 md:right-6
            bottom-[84px] md:bottom-[96px]
            w-[min(92vw,420px)]
            h-[min(70vh,600px)]
            rounded-2xl overflow-hidden shadow-2xl bg-background
          "
          data-testid="chat-panel-workspace"
        >
          <ChatPanel />
        </div>
      )}
    </>,
    document.body
  );
}
