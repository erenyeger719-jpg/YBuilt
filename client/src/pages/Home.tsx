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

/* ========= Floating chat (unchanged) ========= */
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

/* ========= Seam: dark hero → white world ========= */
function HeroToWhiteSeam() {
  return (
    <div
      aria-hidden
      className="relative h-24"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.55) 40%, #ffffff 100%)",
      }}
    />
  );
}

/* ========= Helpers ========= */
type NodeDef = { id: string; label: string; x: number; y: number; href: string };
type NodeDetail = { headline: string; blurb: string; bullets: string[] };

const START_NODES: NodeDef[] = [
  { id: "portfolio", label: "Portfolio", x: 140, y: 120, href: "/studio?template=portfolio" },
  { id: "blog",      label: "Blog / Magazine", x: 330, y: 90,  href: "/studio?template=blog" },
  { id: "shop",      label: "Shop",     x: 530, y: 120, href: "/studio?template=shop" },
  { id: "saas",      label: "SaaS Landing", x: 740, y: 90,  href: "/studio?template=saas" },
  { id: "dashboard", label: "Dashboard", x: 240, y: 260, href: "/studio?template=dashboard" },
  { id: "docs",      label: "Docs",     x: 470, y: 240, href: "/studio?template=docs" },
  { id: "mobile",    label: "Mobile Shell", x: 760, y: 240, href: "/studio?template=mobile" },
  { id: "booking",   label: "Booking",  x: 170, y: 420, href: "/studio?template=booking" },
  { id: "education", label: "Education",x: 380, y: 410, href: "/studio?template=education" },
  { id: "community", label: "Community",x: 600, y: 420, href: "/studio?template=community" },
  { id: "ai",        label: "AI App",   x: 840, y: 380, href: "/studio?template=ai" },
];

const EDGES: [string, string][] = [
  ["portfolio","blog"],["blog","shop"],["shop","saas"],
  ["blog","docs"],["docs","dashboard"],["docs","education"],
  ["dashboard","booking"],["shop","community"],["community","ai"],
  ["saas","mobile"],["mobile","ai"],
];

const DETAILS: Record<string, NodeDetail> = {
  portfolio: { headline:"Show your work beautifully", blurb:"Hero + case grid + contact form.", bullets:["Galleries","CMS-ready","SEO blocks"] },
  blog:      { headline:"Write long, publish fast",   blurb:"Magazine layout with tags & TOC.", bullets:["MDX","Search & filters","Reading progress"] },
  shop:      { headline:"Sell in style",              blurb:"Cards, cart drawer, checkout hooks.", bullets:["Variants","Promos","Analytics events"] },
  saas:      { headline:"Convert with confidence",    blurb:"Hero, features, social proof.", bullets:["A/B slots","Pricing tables","Signup CTA"] },
  dashboard: { headline:"Your data, your way",        blurb:"Sidebar shell + charts.", bullets:["RBAC layout","Empty states","Skeletons"] },
  docs:      { headline:"Teach with clarity",         blurb:"Left nav, sticky headings, search.", bullets:["MDX/MD","Versioning stubs","Copy buttons"] },
  mobile:    { headline:"One code, many screens",     blurb:"PWA shell with tabs.", bullets:["Installable","Offline scaffold","Touch UX"] },
  booking:   { headline:"Schedule anything",          blurb:"Slots, confirmations, reminders.", bullets:["TZ aware","Embeds","Webhooks"] },
  education: { headline:"Teach & track",              blurb:"Courses, lessons, progress.", bullets:["Lesson player","Notes","Badges"] },
  community: { headline:"Gather your people",         blurb:"Feed, profiles, threads.", bullets:["Moderation","Mentions","Notifications"] },
  ai:        { headline:"Ship an AI tool",            blurb:"Prompt UI + streaming.", bullets:["File inputs","Rate limits","Observability"] },
};

/* Small view-transition wrapper (safe if unsupported) */
function withViewTransition(update: () => void) {
  const anyDoc = document as any;
  if (anyDoc.startViewTransition) anyDoc.startViewTransition(update);
  else update();
}

/* ========= Magnetic buttons (only in white section) ========= */
function useLocalMagnet(root: HTMLElement | null) {
  useEffect(() => {
    if (!root) return;
    let last: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      const t = (e.target as HTMLElement)?.closest<HTMLElement>(".btn-magnetic");
      if (t) {
        last = t;
        const b = t.getBoundingClientRect();
        const x = e.clientX - (b.left + b.width / 2);
        const y = e.clientY - (b.top + b.height / 2);
        const clamp = (v: number) => Math.max(-24, Math.min(24, v));
        t.style.setProperty("--tx", clamp(x * 0.15) + "px");
        t.style.setProperty("--ty", clamp(y * 0.15) + "px");
      } else if (last) {
        last.style.setProperty("--tx", "0px");
        last.style.setProperty("--ty", "0px");
        last = null;
      }
    };
    const onLeave = () => {
      if (last) {
        last.style.setProperty("--tx", "0px");
        last.style.setProperty("--ty", "0px");
        last = null;
      }
    };
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [root]);
}

/* ========= NodeSpace: draggable graph with tasteful grid patches ========= */
function NodeSpace({
  onOpen,
}: {
  onOpen: (n: NodeDef) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes] = useState(() => START_NODES.map(n => ({...n})));
  const [dragId, setDragId] = useState<string | null>(null);
  const velRef = useRef<Record<string, {vx: number; vy: number}>>({});
  const lastRef = useRef<{t: number; x: number; y: number} | null>(null);

  // magnetic only inside this white section
  useLocalMagnet(wrapRef.current);

  // inertia loop
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (dragId) return; // pause inertia while dragging
      const vels = velRef.current;
      let moving = false;

      setNodes(prev => prev.map(n => {
        const v = vels[n.id];
        if (!v) return n;
        // friction
        v.vx *= 0.94;
        v.vy *= 0.94;
        if (Math.abs(v.vx) < 0.02 && Math.abs(v.vy) < 0.02) {
          delete vels[n.id];
          return n;
        }
        moving = true;
        // bounds
        const W = 1000, H = 600, pad = 60;
        let nx = n.x + v.vx;
        let ny = n.y + v.vy;
        if (nx < pad || nx > W - pad) { v.vx *= -0.6; nx = Math.min(W - pad, Math.max(pad, nx)); }
        if (ny < pad || ny > H - pad) { v.vy *= -0.6; ny = Math.min(H - pad, Math.max(pad, ny)); }
        return {...n, x: nx, y: ny};
      }));

      if (!moving) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dragId]);

  function startDrag(e: React.PointerEvent, id: string) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragId(id);
    lastRef.current = { t: performance.now(), x: e.clientX, y: e.clientY };
  }
  function onDrag(e: React.PointerEvent, id: string) {
    if (dragId !== id) return;
    const now = performance.now();
    const L = lastRef.current!;
    const dt = Math.max(16, now - L.t);
    const dx = e.clientX - L.x;
    const dy = e.clientY - L.y;
    lastRef.current = { t: now, x: e.clientX, y: e.clientY };

    setNodes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const W = 1000, H = 600, pad = 60;
      let nx = n.x + (dx / 1.0); // scale pixels→plane
      let ny = n.y + (dy / 1.0);
      nx = Math.min(W - pad, Math.max(pad, nx));
      ny = Math.min(H - pad, Math.max(pad, ny));
      // velocity for inertia
      velRef.current[id] = { vx: (dx / (dt/16)), vy: (dy / (dt/16)) };
      return { ...n, x: nx, y: ny };
    }));
  }
  function endDrag(e: React.PointerEvent, id: string) {
    if (dragId !== id) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setDragId(null);
  }

  const hoverRef = useRef<string | null>(null);
  const setHover = (id: string | null) => { hoverRef.current = id; };

  return (
    <div ref={wrapRef} className="relative w-full max-w-6xl mx-auto" style={{ height: 520 }}>
      {/* flowing “weavy” background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            // soft waves + light blobs
            `radial-gradient(60% 40% at 15% 20%, rgba(0,0,0,0.04), transparent 60%),
             radial-gradient(55% 45% at 85% 25%, rgba(0,0,0,0.035), transparent 60%),
             radial-gradient(50% 45% at 45% 80%, rgba(0,0,0,0.03), transparent 60%),
             conic-gradient(from 200deg at 50% 50%, rgba(0,0,0,0.02), rgba(0,0,0,0.06), rgba(0,0,0,0.02))`,
          maskImage:
            "radial-gradient(120% 120% at 50% 50%, black 60%, transparent 100%)",
        }}
      />

      {/* selective grid patches (big cells) */}
      <GridPatch left="6%"  top="8%"  width="28%" height="38%" />
      <GridPatch left="64%" top="10%" width="28%" height="30%" />
      <GridPatch left="22%" top="58%" width="36%" height="28%" />

      {/* edges */}
      <svg className="absolute inset-0" viewBox="0 0 1000 600" preserveAspectRatio="none">
        {EDGES.map(([a,b]) => {
          const A = nodes.find(n=>n.id===a)!; const B = nodes.find(n=>n.id===b)!;
          return (
            <line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke="rgba(0,0,0,.12)" strokeWidth="2" />
          );
        })}
      </svg>

      {/* nodes (draggable + clickable) */}
      {nodes.map((n) => (
        <div
          key={n.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${(n.x/1000)*100}%`, top: `${(n.y/600)*100}%` }}
        >
          <button
            className="group rounded-full border bg-white/90 backdrop-blur px-4 py-2 shadow-sm hover:shadow-md active:scale-[.98] transition
                       relative"
            onPointerDown={(e)=>startDrag(e,n.id)}
            onPointerMove={(e)=>onDrag(e,n.id)}
            onPointerUp={(e)=>endDrag(e,n.id)}
            onPointerCancel={(e)=>endDrag(e,n.id)}
            onMouseEnter={()=>setHover(n.id)}
            onMouseLeave={()=>setHover(null)}
            onClick={(e)=>{ e.preventDefault(); withViewTransition(()=>onOpen(n)); }}
          >
            <span className="text-sm font-medium text-neutral-900">{n.label}</span>
            <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* hover mini */}
          {hoverRef.current === n.id && (
            <div className="absolute left-1/2 -translate-x-1/2 -translate-y-full -mt-3">
              <div className="rounded-md border bg-white/95 shadow p-2 w-[220px]">
                <div className="text-xs font-medium">{n.label}</div>
                <div className="text-[11px] text-neutral-600 line-clamp-2">{DETAILS[n.id]?.blurb}</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* a single big-cell grid patch */
function GridPatch({ left, top, width, height }:{
  left:string; top:string; width:string; height:string;
}) {
  return (
    <div
      className="absolute pointer-events-none opacity-50"
      style={{
        left, top, width, height,
        backgroundImage:
          `repeating-linear-gradient(0deg, rgba(0,0,0,.06) 0 1px, transparent 1px 32px),
           repeating-linear-gradient(90deg, rgba(0,0,0,.06) 0 1px, transparent 1px 32px)`,
        border: "1px solid rgba(0,0,0,.08)",
        borderRadius: 12,
        backdropFilter: "blur(2px)",
      }}
    />
  );
}

/* ========= Spec sheet dialog ========= */
function SpecSheet({ node, onClose }: { node: NodeDef | null; onClose: () => void }) {
  const d = node ? DETAILS[node.id] : null;
  return (
    <Dialog open={!!node} onOpenChange={(v)=>!v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{node?.label}</DialogTitle></DialogHeader>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Drop your media later */}
          <div className="aspect-video rounded-xl border bg-neutral-100 grid place-items-center">
            <span className="text-neutral-500 text-sm">PREVIEW_PLACEHOLDER — {node?.id}</span>
          </div>
          <div>
            <div className="text-lg font-semibold">{d?.headline}</div>
            <p className="text-sm text-neutral-600 mt-2">{d?.blurb}</p>
            <ul className="mt-4 space-y-2">
              {d?.bullets.map((b)=>(
                <li key={b} className="text-sm text-neutral-800 flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 opacity-70"/><span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <a href={node?.href} className="w-full sm:w-auto">
            <Button className="btn-magnetic w-full">Use this template</Button>
          </a>
          <Button variant="secondary" className="btn-magnetic border w-full sm:w-auto" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========= Heavy-like white sections with art direction ========= */
function WhiteWorld() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<NodeDef | null>(null);

  // local magnetic for CTAs in this section only
  useLocalMagnet(rootRef.current);

  return (
    <div ref={rootRef} className="bg-white text-neutral-900 relative overflow-hidden">
      {/* soft ribbons across the section */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            `linear-gradient(115deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.0) 32% 68%, rgba(0,0,0,0.04) 100%),
             radial-gradient(80% 60% at 50% 120%, rgba(0,0,0,0.06), transparent 60%)`,
          mixBlendMode: "multiply",
        }}
      />

      {/* Intro */}
      <section className="relative max-w-6xl mx-auto px-6 pt-10">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Pick what you want to build</h2>
        <p className="text-neutral-600 mt-2">Move the nodes. Click one to open its spec sheet.</p>
      </section>

      {/* Draggable node map with tasteful grid patches */}
      <section className="relative px-2 sm:px-6 pb-8">
        <NodeSpace onOpen={setActive} />
      </section>

      {/* Feature slab with magnetic CTAs (only here) */}
      <section className="relative border-t">
        <div className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h3 className="text-2xl sm:text-3xl font-semibold">Design that reacts to you</h3>
            <p className="mt-3 text-neutral-600">
              Weavy ambience, Heavy mechanics. Fast, deliberate, and art-directed.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="/studio"><Button className="btn-magnetic">Open Studio</Button></a>
              <a href="/library"><Button variant="secondary" className="btn-magnetic border">Explore templates</Button></a>
            </div>
          </div>
          <div className="aspect-video rounded-xl border bg-neutral-100 grid place-items-center">
            <span className="text-neutral-500 text-sm">VIDEO_PLACEHOLDER</span>
          </div>
        </div>
      </section>

      {/* Gallery with big-cell grid background behind only some cards */}
      <section className="relative border-t">
        <div className="absolute right-[6%] top-10 w-[38%] h-[60%] opacity-45 pointer-events-none"
          style={{
            backgroundImage:
              `repeating-linear-gradient(0deg, rgba(0,0,0,.06) 0 1px, transparent 1px 40px),
               repeating-linear-gradient(90deg, rgba(0,0,0,.06) 0 1px, transparent 1px 40px)`,
            borderRadius: 12,
          }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-16">
          <h3 className="text-2xl sm:text-3xl font-semibold">Real patterns, ready to ship</h3>
          <p className="mt-3 text-neutral-600">Placeholders now—drop your images/videos later.</p>

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
      <section className="relative border-t">
        <div className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div className="aspect-video rounded-xl border bg-neutral-100 grid place-items-center order-last lg:order-first">
            <span className="text-neutral-500 text-sm">VIDEO_PLACEHOLDER (deploy)</span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-semibold">From draft to live</h3>
            <p className="mt-3 text-neutral-600">Beginner → Pro → Business. Switch anytime.</p>
            <div className="mt-6">
              <a href="/studio"><Button className="btn-magnetic">Start free</Button></a>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative border-t">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight">Ready when you are.</h3>
          <p className="text-neutral-600 mt-3">Keep your hero look. Gain the art-directed build flow below.</p>
          <div className="mt-6 flex justify-center gap-3">
            <a href="/studio"><Button className="btn-magnetic">Create a project</Button></a>
            <a href="/library"><Button variant="secondary" className="btn-magnetic border">Watch demo</Button></a>
          </div>
        </div>
      </section>

      {/* Node spec sheet */}
      <SpecSheet node={active} onClose={()=>withViewTransition(()=>setActive(null))} />
    </div>
  );
}

/* ========= Page ========= */
export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Your original top hero stays exactly the same */}
      <Header />
      <Hero />

      {/* Transition into the Weavy/Heavy world */}
      <HeroToWhiteSeam />
      <WhiteWorld />

      {/* Floating chat */}
      <FloatingChat isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
    </div>
  );
}
