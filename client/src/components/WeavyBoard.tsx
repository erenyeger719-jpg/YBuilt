import React, { useEffect, useMemo, useRef, useState } from "react";

type NodeId = "prompt" | "design" | "sections" | "data" | "auth" | "deploy" | "preview";
type AnchorSide = "l" | "r" | "t" | "b";
type Pos = { x: number; y: number };

type NodeDef = {
  id: NodeId;
  label: string;
  title: string;
  w: number;
  h: number;
  x: number;
  y: number;
  media?: "image" | "video" | "text";
};

type Edge = { from: [NodeId, AnchorSide]; to: [NodeId, AnchorSide] };

const NODES: NodeDef[] = [
  { id: "prompt",   label: "INPUT",        title: "Type your idea →",  w: 280, h: 92,  x: 140,  y: 40,  media: "text"  },
  { id: "design",   label: "DESIGN SYSTEM",title: "Theme & Tokens",    w: 360, h: 240, x: 320,  y: 140, media: "image" },
  { id: "sections", label: "SECTIONS",     title: "Hero • Pricing …",  w: 380, h: 260, x: 720,  y: 110, media: "video" },
  { id: "data",     label: "DATA",         title: "CMS / DB",          w: 260, h: 190, x: 540,  y: 420, media: "image" },
  { id: "auth",     label: "AUTH",         title: "Accounts",          w: 220, h: 160, x: 860,  y: 420, media: "image" },
  { id: "deploy",   label: "DEPLOY",       title: "One-click ship",    w: 320, h: 210, x: 1120, y: 280, media: "video" },
  { id: "preview",  label: "LIVE PREVIEW", title: "Canvas output",     w: 420, h: 300, x: 40,   y: 360, media: "image" },
];

const EDGES: Edge[] = [
  { from: ["prompt","r"],   to: ["design","l"] },
  { from: ["design","r"],   to: ["sections","l"] },
  { from: ["sections","b"], to: ["data","t"] },
  { from: ["sections","b"], to: ["auth","t"] },
  { from: ["data","r"],     to: ["deploy","l"] },
  { from: ["auth","r"],     to: ["deploy","l"] },
  { from: ["sections","t"], to: ["preview","r"] },
  { from: ["design","t"],   to: ["preview","t"] },
];

const SPRING_MS = 520;
const clamp = (v:number, a:number, b:number)=> Math.min(b, Math.max(a, v));

const bezier = (s:Pos, e:Pos) => {
  const dx = Math.abs(e.x - s.x);
  const c1 = { x: s.x + dx * 0.38, y: s.y };
  const c2 = { x: e.x - dx * 0.38, y: e.y };
  return `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`;
};

export default function WeavyBoard() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<NodeId, HTMLDivElement | null>>({} as any);

  const [pos, setPos] = useState<Record<NodeId, Pos>>(
    Object.fromEntries(NODES.map(n => [n.id, { x: n.x, y: n.y }])) as Record<NodeId, Pos>
  );
  const origins = useRef<Record<NodeId, Pos>>(
    Object.fromEntries(NODES.map(n => [n.id, { x: n.x, y: n.y }])) as Record<NodeId, Pos>
  );

  const dragging = useRef<{ id: NodeId; start: Pos; nodeStart: Pos } | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick(t => t + 1);
    const ro = new ResizeObserver(on);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);

  const onDown = (id: NodeId) => (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = { id, start: { x: e.clientX, y: e.clientY }, nodeStart: { ...pos[id] } };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current || !wrapRef.current) return;
    const wrap = wrapRef.current.getBoundingClientRect();
    const { id, start, nodeStart } = dragging.current;
    const nx = clamp(nodeStart.x + (e.clientX - start.x), 8, wrap.width - 40);
    const ny = clamp(nodeStart.y + (e.clientY - start.y), 8, wrap.height - 40);
    setPos(p => ({ ...p, [id]: { x: nx, y: ny } }));
  };
  const onUp = () => {
    if (!dragging.current) return;
    const { id } = dragging.current;
    dragging.current = null;

    const from = pos[id];
    const to = origins.current[id];
    const start = performance.now();
    const ease = (t:number) => {
      const k = 7.5, z = 0.85;
      return 1 - Math.exp(-k*t) * Math.cos((k*Math.sqrt(1 - z*z))*t);
    };
    const raf = (now:number) => {
      const t = Math.min(1, (now - start) / SPRING_MS);
      const m = ease(t);
      setPos(p => ({ ...p, [id]: { x: from.x + (to.x - from.x) * m, y: from.y + (to.y - from.y) * m } }));
      if (t < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  };

  const anchor = (id: NodeId, side: AnchorSide): Pos => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const el = nodeRefs.current[id];
    if (!wrap || !el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const cx = side === "l" ? r.left : side === "r" ? r.right : r.left + r.width/2;
    const cy = side === "t" ? r.top : side === "b" ? r.bottom : r.top + r.height/2;
    return { x: cx - wrap.left, y: cy - wrap.top };
  };

  const wires = useMemo(() => {
    return EDGES.map((e, i) => {
      const s = anchor(...e.from);
      const t = anchor(...e.to);
      const d = bezier(s, t);
      const mid = { x: (s.x + t.x)/2, y: (s.y + t.y)/2 };
      return { key: i, d, s, t, mid };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  return (
    <section className="weavy-section">
      <div className="max-w-6xl mx-auto px-6 pt-14">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">How it turns a prompt into a product</h2>
        <p className="text-sm text-muted-foreground mt-1">Move the nodes. They snap back. Media slots are blank for your assets.</p>
      </div>

      <div className="grid-band" style={{ top: 96, height: 560 }} />

      <div
        ref={wrapRef}
        className="relative max-w-[1200px] mx-auto mt-6 mb-24 rounded-2xl"
        style={{ height: 700 }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      >
        <svg className="absolute inset-0 z-0" width="100%" height="100%" role="presentation">
          <defs>
            <filter id="threadShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.25" />
            </filter>
          </defs>
          {wires.map(w => (
            <g className="wire-thread" key={w.key}>
              <path d={w.d} />
              <circle className="wire-dot" r={4} cx={w.s.x} cy={w.s.y} />
              <circle className="wire-dot" r={4} cx={w.t.x} cy={w.t.y} />
              <circle className="wire-bead" r={3.5} cx={w.mid.x} cy={w.mid.y} />
            </g>
          ))}
        </svg>

        {NODES.map(n => {
          const p = pos[n.id];
          return (
            <div
              key={n.id}
              ref={(el) => (nodeRefs.current[n.id] = el)}
              className="node-card shadow-sm"
              style={{ position:"absolute", width:n.w, height:n.h, transform:`translate(${p.x}px, ${p.y}px)` }}
              onPointerDown={onDown(n.id)}
            >
              <span className="nub nub-l" /><span className="nub nub-r" />
              <span className="nub nub-t" /><span className="nub nub-b" />

              <div className="node-label">{n.label}</div>
              <div className="px-3 pb-2 text-sm font-medium">{n.title}</div>

              <div className="slot-media">
                <div className="placeholder">
                  {n.media === "image" && "Image placeholder"}
                  {n.media === "video" && "Video placeholder"}
                  {n.media === "text"  && "Text prompt example"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
