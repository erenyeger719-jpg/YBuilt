import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

/**
 * Docked chat for Home & Library pages.
 * Portaled to <body> so page containers can't clip it.
 */
export default function ChatDock() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [headerH, setHeaderH] = useState(64); // fallback

  // Measure header height so the dock sits just beneath it (kept; harmless if unused)
  useEffect(() => {
    setMounted(true);
    const measure = () => {
      const el =
        document.querySelector("[data-header]") ||
        document.querySelector("header");
      const h = el ? Math.ceil((el as HTMLElement).getBoundingClientRect().height) : 64;
      setHeaderH(h);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      setMounted(false);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Launcher */}
      <Button
        size="icon"
        variant="secondary"
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed top-14 md:top-16 right-4 md:right-6 z-[300] h-10 w-10 rounded-full shadow-md"
        data-testid="button-chat-dock"
        style={{ left: "auto" }} /* force off any stray left */
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat panel"
          className="
            fixed z-[280]
            top-20 md:top-[88px] right-4 md:right-6
            bottom-4
            w-[min(92vw,420px)]
            rounded-2xl overflow-hidden
            shadow-2xl bg-background
          "
          data-testid="chat-panel-dock"
          style={{ left: "auto" }} /* same safety */
        >
          <ChatPanel />
        </div>
      )}
    </>,
    document.body
  );
}
