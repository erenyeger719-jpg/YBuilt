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

  return createPortal(
    <>
      {/* FIXED bottom-right with explicit classes; no inline calc/env */}
      <Button
        size="icon"
        variant="secondary"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-4 right-4 z-[300] h-11 w-11 md:h-12 md:w-12 rounded-full shadow-md"
        data-testid="button-chat-workspace"
        style={{ left: "auto", top: "auto" }}  // hard override any weird globals
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Chat panel"
          className="
            fixed bottom-24 right-4 z-[280]
            w-[min(92vw,440px)]
            max-h-[75vh]
            rounded-2xl overflow-hidden bg-background shadow-2xl
          "
          data-testid="panel-chat-workspace"
          style={{ left: "auto", top: "auto" }}
        >
          <ChatPanel />
        </div>
      )}
    </>,
    document.body
  );
}
