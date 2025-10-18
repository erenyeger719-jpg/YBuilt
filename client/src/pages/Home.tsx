// client/src/pages/Home.tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ChatPanel from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageCircle, X, ArrowRight, Check } from "lucide-react";

/* ---------------- Floating chat (unchanged) ---------------- */
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

/* ---------------- Seam from dark hero into white ---------------- */
function HeroToWhiteSeam() {
  return (
    <div
      aria-hidden
      className="relative h-24"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.6) 40%, #ffffff 100%)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
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

/* ---------------- Node Graph + Spec Sheets ---------------- */
type NodeDef = {
  id: string;
  label: string;
  x: number; // 1000x600 virtual plane
  y: number;
  href: string; // where “Use template” goes
};

const NODES: NodeDef[] = [
  { id: "portfolio", label: "Portfolio", x: 150, y: 120, href: "/studio?template=portfolio" },
  { id: "blog", label: "Blog / Magazine", x: 330, y: 80, href: "/studio?template=blog" },
  { id: "shop", label: "Shop", x: 520, y: 120, href: "/studio?template=shop" },
  { id: "saas", label: "SaaS Landing", x: 700, y: 90, href: "/studio?template=saas" },
  { id: "dashboard", label: "Dashboard", x: 240, y: 260, href: "/studio?template=dashboard" },
  { id: "docs", label: "Docs", x: 460, y: 240, href: "/studio?template=docs" },
  { id: "mobile", label: "Mobile Shell", x: 720, y: 240, href: "/studio?template=mobile" },
  { id: "booking", label: "Booking", x: 170, y: 420, href: "/studio?template=booking" },
  { id: "education", label: "Education", x: 380, y: 410, href: "/studio?template=education" },
  { id: "community", label: "Community", x: 600, y: 420, href: "/studio?template=community" },
  { id: "ai", label: "AI App", x: 820, y: 380, href: "/studio?template=ai" },
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

type NodeDetail = {
  headline: string;
  blurb: string;
  bullets: string[];
};

const DETAILS: Record<string, NodeDetail> = {
  portfolio: {
    headline: "Show your work beautifully",
    blurb: "Hero + case grid + contact form. Dark/Light ready out of the box.",
    bullets: ["Image/video galleries", "CMS-friendly structure", "SEO blocks"],
  },
  blog: {
    headline: "Write long, publish fast",
    blurb: "Magazine layout with tags, TOC, and code blocks.",
    bullets: ["MDX-ready", "Search & filters", "Reading progress"],
  },
  shop: {
    headline: "Sell in style",
    blurb: "Product cards, cart drawer, checkout handoff hooks.",
    bullets: ["Variant options", "Promo sections", "Analytics events"],
  },
  saas: {
    headline: "Convert with confidence",
    blurb: "Landing sections that snap: hero, features, social proof.",
    bullets: ["Hero A/B slots", "Pricing tables", "Signup CTA wiring"],
  },
  dashboard: {
    headline: "Your data, your way",
    blurb: "Sidebar, cards, charts, and auth shell.",
    bullets: ["Role-based layout", "Empty states", "Skeleton loading"],
  },
  docs: {
    headline: "Teach with clarity",
    blurb: "Left nav, right content, sticky headings, and search.",
    bullets: ["MDX/Markdown", "Versioning stubs", "Copy-to-clipboard"],
  },
  mobile: {
    headline: "One code, many screens",
    blurb: "PWA shell with tab bar and responsive panes.",
    bullets: ["Installable", "Offline scaffold", "Touch interactions"],
  },
  booking: {
    headline: "Schedule anything",
    blurb: "Calendar slots, confirmations, and reminders.",
    bullets: ["Timezone aware", "Embeds", "Webhook exits"],
  },
  education: {
    headline: "Teach & track",
    blurb: "Course pages, lessons, progress, and quizzes.",
    bullets: ["Lesson player", "Notes", "Completion badges"],
  },
  community: {
    headline: "Gather your people",
    blurb: "Feed, profiles, and threads with reactions.",
    bullets: ["Moderation stubs", "Mentions", "Notifications"],
  },
  ai: {
    headline: "Ship an AI tool",
    blurb: "Prompt UI, history, and streaming responses.",
    bullets: ["File inputs", "Rate limits", "Observability hooks"],
  },
};

/** View-transition helper (safe no-op if unsupported) */
function withViewTransition(update: () => void) {
  const anyDoc = document as any;
  if (anyDoc.startViewTransition) {
    anyDoc.startViewTransition(update);
  } else {
    update();
  }
}

/** Mini hover preview card (simple, no deps) */
function HoverCardMini({ node }: { node: NodeDef }) {
  const d = DETAILS[node.id];
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-full -mt-4"
      style={{
        left: `${(node.x / 1000) * 100}%`,
        top: `${(node.y / 600) * 100}%`,
      }}
    >
      <div className="rounded-lg border bg-white/95 shadow-md backdrop-blur px-3 py-2 w-[220px]">
        <div className="text-xs font-medium">{node.label}</div>
        <div className="text-[11px] text-neutral-600 line-clamp-2">{d?.blurb}</div>
      </div>
    </div>
  );
}

function NodeGraph({
  onOpen,
}: {
  onOpen: (node: NodeDef) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

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
        el.style.setProperty("--dx", String(px * 18));
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

  const hoverNode = hoverId ? NODES.find((n) => n.id === hoverId) || null : null;

  return (
    <div ref={ref} className="relative w-full max-w-6xl mx-auto" style={{ height: 520 }}>
      {/* lines */}
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

      {/* nodes */}
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
          onMouseEnter={() => setHoverId(n.id)}
          onMouseLeave={() => setHoverId((id) => (id === n.id ? null : id))}
          onClick={(e) => {
            // open spec sheet instead of navigating directly
            e.preventDefault();
            withViewTransition(() => onOpen(n));
          }}
        >
          <div className="rounded-full border bg-white/90 backdrop-blur px-4 py-2 shadow-sm hover:shadow-md">
            <span className="text-sm font-medium text-neutral-900">{n.label}</span>
            <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </a>
      ))}

      {/* hover mini */}
      {hoverNode && <HoverCardMini node={hoverNode} />}
    </div>
  );
}

/* ---------------- Spec Sheet Dialog ---------------- */
function SpecSheet({
  node,
  onClose,
}: {
  node: NodeDef | null;
  onClose: () => void;
}) {
  const open = Boolean(node);
  const d = node ? DETAILS[node.id] : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {node?.label}
          </DialogTitle>
        </DialogHeader>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Preview placeholder (drop your video/image later) */}
          <div className="aspect-video rounded-xl border bg-neutral-100 grid place-items-center">
            <span className="text-neutral-500 text-sm">
              PREVIEW_PLACEHOLDER — {node?.id}
            </span>
          </div>

          {/* Copy */}
          <div>
            <div className="text-lg font-semibold">{d?.headline}</div>
            <p className="text-sm text-neutral-600 mt-2">{d?.blurb}</p>

            <ul className="mt-4 space-y-2">
              {d?.bullets.map((b) => (
                <li key={b} className="text-sm text-neutral-800 flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 opacity-70" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {/* Primary goes to Studio with template param */}
          <a href={node?.href} className="w-full sm:w-auto">
            <Button className="btn btn-magnetic w-full">Use this template</Button>
          </a>
          <Button variant="secondary" className="btn btn-magnetic border w-full sm:w-auto" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Heavy-style white sections ---------------- */
function HeavySections() {
  const [activeNode, setActiveNode] = useState<NodeDef | null>(null);

  return (
    <div className="bg-white text-neutral-900">
      {/* Intro */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Pick what you want to build
        </h2>
        <p className="text-neutral-600 mt-2">
          Start from a template node, then shape it in the Studio.
        </p>
      </section>

      {/* Graph */}
      <section className="px-2 sm:px-6 pb-8">
        <NodeGraph onOpen={setActiveNode} />
      </section>

      {/* Feature Slab */}
      <section className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h3 className="text-2xl sm:text-3xl font-semibold">Design that reacts to you</h3>
            <p className="mt-3 text-neutral-600">
              Micro-interactions, glossy glass, and a living canvas. All performance-budgeted.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="/studio"><Button className="btn btn-magnetic">Open Studio</Button></a>
              <a href="/library"><Button variant="secondary" className="btn btn-magnetic border">Explore templates</Button></a>
            </div>
          </div>
          <div className="aspect-video rounded-xl border bg-neutral-100 grid place-items-center">
            <span className="text-neutral-500 text-sm">VIDEO_PLACEHOLDER</span>
          </div>
        </div>
      </section>

      {/* Gallery placeholders */}
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

      {/* Deploy slab */}
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
              <a href="/studio"><Button className="btn btn-magnetic">Start free</Button></a>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight">Ready when you are.</h3>
          <p className="text-neutral-600 mt-3">Keep your hero look. Gain Weavy/Heavy-level mechanics below.</p>
          <div className="mt-6 flex justify-center gap-3">
            <a href="/studio"><Button className="btn btn-magnetic">Create a project</Button></a>
            <a href="/library"><Button variant="secondary" className="btn btn-magnetic border">Watch demo</Button></a>
          </div>
        </div>
      </section>

      {/* Spec sheet dialog (mounted once) */}
      <SpecSheet node={activeNode} onClose={() => withViewTransition(() => setActiveNode(null))} />
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Your original top hero stays */}
      <Header />
      <Hero />

      {/* Transition to white Heavy-like body */}
      <HeroToWhiteSeam />
      <HeavySections />

      {/* Floating chat */}
      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
