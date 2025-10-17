// client/src/components/WorkspaceDock.tsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

export default function WorkspaceDock() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!mounted) return null;

  // Safe-area aware offsets (works on iOS notch etc.)
  const pad = 16; // px
  const styleBtn: React.CSSProperties = {
    right: `max(env(safe-area-inset-right), ${pad}px)`,
    bottom: `max(env(safe-area-inset-bottom), ${pad}px)`,
    left: "auto",   // <-- force off any accidental left positioning
    top: "auto",
  };
  const stylePanel: React.CSSProperties = {
    right: `max(env(safe-area-inset-right), ${pad + 8}px)`,
    bottom: `max(env(safe-area-inset-bottom), ${pad + 64}px)`, // leave room for button
    left: "auto",
  };

  return createPortal(
    <>
      <Button
        size="icon"
        variant="secondary"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen(v => !v)}
        className="fixed z-[300] h-11 w-11 md:h-12 md:w-12 rounded-full shadow-md"
        style={styleBtn}
        data-testid="button-chat-workspace"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Chat panel"
          className="
            fixed z-[280]
            w-[min(92vw,440px)]
            max-h-[75vh]
            rounded-2xl overflow-hidden bg-background shadow-2xl
          "
          style={stylePanel}
          data-testid="panel-chat-workspace"
        >
          <ChatPanel />
        </div>
      )}
    </>,
    document.body
  );
}
