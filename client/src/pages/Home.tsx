// client/src/pages/Home.tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ChatPanel from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, X, ArrowRight } from "lucide-react";

/** --- Floating chat (unchanged) --- */
function FloatingChat({
  isChatOpen,
  setIsChatOpen,
}: {
  isChatOpen: boolean;
  setIsChatOpen: (v: boolean) => void;
}) {
  return createPortal(
    <>
      <Button
        size="icon"
        style={{ position: "fixed", bottom: 24, right: 24, left: "auto", zIndex: 70 }}
        className="h-14 w-14 rounded-full shadow-lg"
        onClick={() => setIsChatOpen(!isChatOpen)}
        data-testid="button-toggle-chat"
        aria-label="Toggle chat"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>

      {isChatOpen && (
        <div
          style={{ position: "fixed", bottom: 120, right: 24, left: "auto", zIndex: 60, width: 400, height: 600 }}
          className="shadow-2xl"
          data-testid="chat-panel-container"
        >
          <ChatPanel />
        </div>
      )}
    </>,
    document.body
  );
}

/** --- Seam between dark hero and white body (soft diagonal) --- */
function HeroToWhiteSeam() {
  return (
    <div
      aria-hidden
      className="relative h-24"
      style={{
        // fade from transparent (over your dark hero) to white
        background:
          "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.6) 40%, #ffffff 100%)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          // gentle diagonal wipe like Heavy
          maskImage:
            "linear-gradient(160deg, rgba(0,0,0,1) 45%, rgba(0,0,0,.4) 60%, rgba(0,0,0,0) 75%)",
          WebkitMaskImage:
            "linear-gradient(160deg, rgba(0,0,0,1) 45%, rgba(0,0,0,.4) 60%, rgba(0,0,0,0) 75%)",
          background: "white",
        }}
      />
    </div>
  );
}

/** --- Wired node map (templates) --- */
type NodeDef = {
  id: string;
  label: string;
  x: number; // in a 1000x600 virtual plane
  y: number;
  href: string;
};
const NODES: NodeDef[] = [
  { id: "portfolio", label: "Portfolio", x: 150, y: 120, href: "/studio" },
  { id: "blog", label: "Blog / Magazine", x: 330, y: 80, href: "/studio" },
  { id: "shop", label: "Shop", x: 520, y: 120, href: "/studio" },
  { id: "saas", label: "SaaS Landing", x: 700, y: 90, href: "/studio" },
  { id: "dashboard", label: "Dashboard", x: 240, y: 260, href: "/studio" },
  { id: "docs", label: "Docs", x: 460, y: 240, href: "/studio" },
  { id: "mobile", label: "Mobile Shell", x: 720, y: 240, href: "/studio" },
  { id: "booking", label: "Booking", x: 170, y: 420, href: "/studio" },
  { id: "education", label: "Education", x: 380, y: 410, href: "/studio" },
  { id: "community", label: "Community", x: 600, y: 420, href: "/studio" },
  { id: "ai", label: "AI App", x: 820, y: 380, href: "/studio" },
];

const EDGES: [string, string][] = [
  ["portfolio", "blog"],
  ["blog", "shop"],
  ["shop", "saas"],
  ["blog", "docs"],
  ["docs", "dashboard"],
  ["dashboard", "booking"],
  ["docs", "education"],
  ["shop", "community"],
  ["community", "ai"],
  ["saas", "mobile"],
  ["mobile", "ai"],
];

function NodeGraph() {
  const ref = useRef<HTMLDivElement | null>(null);

  // subtle whole-graph parallax
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
        const py = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
        el.style.setProperty("--dx", String(px * 18)); // max ~18px
        el.style.setProperty("--dy", String(py * 18));
      });
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--dx", "0");
      el.style.setProperty("--dy", "0");
    });
    return () => {
      el.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-6xl mx-auto" style={{ height: 520 }}>
      {/* lines (SVG underlay, moves with the group) */}
      <svg
        className="absolute inset-0"
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        style={{
          transform: "translate3d(calc(var(--dx,0px)*1px), calc(var(--dy,0px)*1px), 0)",
          transition: "transform .12s ease-out",
        }}
      >
        {EDGES.map(([a, b]) => {
          const A = NODES.find((n) => n.id === a)!;
          const B = NODES.find((n) => n.id === b)!;
          return (
            <line
              key={`${a}-${b}`}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke="rgba(0,0,0,.12)"
              strokeWidth="2"
            />
          );
        })}
      </svg>

      {/* nodes (absolute buttons) */}
      {NODES.map((n) => (
        <a
          key={n.id}
          href={n.href}
          className="group absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${(n.x / 1000) * 100}%`,
            top: `${(n.y / 600) * 100}%`,
            transform:
              "translate3d(calc(-50% + var(--dx,0px)*1px), calc(-50% + var(--dy,0px)*1px), 0)",
            transition: "transform .12s ease-out",
          }}
        >
          <div className="rounded-full border bg-white/90 backdrop-blur px-4 py-2 shadow-sm hover:shadow-md">
            <span className="text-sm font-medium text-neutral-900">{n.label}</span>
            <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </a>
      ))}
    </div>
  );
}

/** --- White “Heavy” section stack (placeholders left for you) --- */
function HeavySections() {
  return (
    <div className="bg-white text-neutral-900">
      {/* 1) Node map intro */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Pick what you want to build
        </h2>
        <p className="text-neutral-600 mt-2">
          Start from a template node, then shape it in the Studio.
        </p>
      </section>

      {/* 2) Wired node graph */}
      <section className="px-2 sm:px-6 pb-8">
        <NodeGraph />
      </section>

      {/* 3) Feature slab with VIDEO placeholder */}
      <section className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h3 className="text-2xl sm:text-3xl font-semibold">Design that reacts to you</h3>
            <p className="mt-3 text-neutral-600">
              Micro-interactions, glossy glass, and a living canvas. All performance-budgeted.
            </p>
            <div className="mt-6 flex gap-3">
              <Button className="btn btn-magnetic">Open Studio</Button>
              <Button variant="secondary" className="btn btn-magnetic border">
                Explore templates
              </Button>
            </div>
          </div>
          <div className="aspect-video rounded-xl border bg-neutral-100 grid place-items-center">
            <span className="text-neutral-500 text-sm">VIDEO_PLACEHOLDER</span>
          </div>
        </div>
      </section>

      {/* 4) Image gallery strip (placeholders) */}
      <section className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h3 className="text-2xl sm:text-3xl font-semibold">Real patterns, ready to ship</h3>
          <p className="mt-3 text-neutral-600">Swap sections live. Bring your assets when ready.</p>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-0 overflow-hidden border">
                <div className="aspect-[4/3] bg-neutral-100 grid place-items-center">
                  <span className="text-neutral-500 text-xs">IMAGE_PLACEHOLDER #{i + 1}</span>
                </div>
                <div className="p-4">
                  <div className="text-sm font-medium">Template slot {i + 1}</div>
                  <div className="text-xs text-neutral-600">Short description goes here.</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 5) Deploy slab */}
      <section className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div className="aspect-video rounded-xl border bg-neutral-100 grid place-items-center order-last lg:order-first">
            <span className="text-neutral-500 text-sm">VIDEO_PLACEHOLDER (deploy)</span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-semibold">From draft to live</h3>
            <p className="mt-3 text-neutral-600">
              Beginner → Pro → Business presets. Switch later; we migrate the config.
            </p>
            <div className="mt-6">
              <Button className="btn btn-magnetic">Start free</Button>
            </div>
          </div>
        </div>
      </section>

      {/* 6) Final CTA on white */}
      <section className="border-t">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight">Ready when you are.</h3>
          <p className="text-neutral-600 mt-3">
            Keep your hero look. Gain Weavy/Heavy-level mechanics below.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button className="btn btn-magnetic">Create a project</Button>
            <Button variant="secondary" className="btn btn-magnetic border">
              Watch demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* TOP — keep exactly as your screenshot: Header + Hero */}
      <Header />
      <Hero />

      {/* Seam into white Heavy-style body */}
      <HeroToWhiteSeam />

      {/* Heavy/Weavy-style lower half on white */}
      <HeavySections />

      {/* Chat stays */}
      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
