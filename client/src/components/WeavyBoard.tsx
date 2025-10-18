import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Utilities */
type Pt = { x: number; y: number };
type Node = { id: string; title: string; x: number; y: number; w: number; h: number };

const GRID = 16; // “one space”

function snap(v: number) { return Math.round(v / GRID) * GRID; }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Cubic curve that feels like a wire (direction-aware handles) */
function wirePath(a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const k = 0.33; // handle strength
  const cx1 = a.x + dx * k;
  const cy1 = a.y + dy * 0.05;
  const cx2 = b.x - dx * k;
  const cy2 = b.y - dy * 0.05;
  return `M ${a.x} ${a.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${b.x} ${b.y}`;
}

/** Anchor helpers (center of each edge) */
function anchors(n: Node) {
  return {
    l: { x: n.x, y: n.y + n.h / 2 },
    r: { x: n.x + n.w, y: n.y + n.h / 2 },
    t: { x: n.x + n.w / 2, y: n.y },
    b: { x: n.x + n.w / 2, y: n.y + n.h },
  };
}

/** Initial nodes */
const START: Node[] = [
  { id: "portfolio", title: "Portfolio", x: 220, y: 120, w: 152, h: 48 },
  { id: "blog",      title: "Blog / Magazine", x: 460, y: 90,  w: 192, h: 48 },
  { id: "shop",      title: "Shop",            x: 780, y: 120, w: 112, h: 48 },
  { id: "saas",      title: "SaaS Landing",    x: 980, y: 100, w: 168, h: 48 },
  { id: "dashboard", title: "Dashboard",       x: 300, y: 240, w: 148, h: 48 },
  { id: "docs",      title: "Docs",            x: 620, y: 240, w: 104, h: 48 },
  { id: "mobile",    title: "Mobile Shell",    x: 900, y: 260, w: 164, h: 48 },
  { id: "booking",   title: "Booking",         x: 240, y: 380, w: 128, h: 48 },
  { id: "education", title: "Education",       x: 520, y: 400, w: 144, h: 48 },
  { id: "community", title: "Community",       x: 760, y: 440, w: 152, h: 48 },
  { id: "aiapp",     title: "AI App",          x: 1040,y: 460, w: 116, h: 48 },
];

/** Simple wiring map: [fromId, fromAnchor, toId, toAnchor] */
const LINKS: Array<[string,"l"|"r"|"t"|"b",string,"l"|"r"|"t"|"b"]> = [
  ["portfolio","r","blog","l"],
  ["blog","r","shop","l"],
  ["shop","r","saas","l"],
  ["blog","b","docs","t"],
  ["docs","b","education","t"],
  ["education","r","community","l"],
  ["community","r","aiapp","l"],
  ["shop","b","mobile","t"],
];

/** Main board */
export default function WeavyBoard() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>(START);

  // dragging
  const dragId = useRef<string | null>(null);
  const grabOffset = useRef<Pt>({ x: 0, y: 0 });

  useEffect(() => {
    const el = wrapRef.current!;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]');
      if (!target) return;
      const id = target.dataset.nodeId!;
      const n = nodes.find(n => n.id === id);
      if (!n) return;

      dragId.current = id;
      const rect = el.getBoundingClientRect();
      grabOffset.current = { x: e.clientX - rect.left - n.x, y: e.clientY - rect.top - n.y };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragId.current) return;
      const rect = el.getBoundingClientRect();
      const id = dragId.current;
      setNodes(prev => prev.map(n => {
        if (n.id !== id) return n;
        let nx = e.clientX - rect.left - grabOffset.current.x;
        let ny = e.clientY - rect.top - grabOffset.current.y;
        // snap-to-grid & clamp to board
        nx = snap(nx); ny = snap(ny);
        nx = clamp(nx, 0, rect.width - n.w);
        ny = clamp(ny, 0, rect.height - n.h);
        return { ...n, x: nx, y: ny };
      }));
    };

    const onUp = () => { dragId.current = null; };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [nodes]);

  // recompute anchor map fast
  const map = Object.fromEntries(nodes.map(n => [n.id, n])) as Record<string, Node>;

  return (
    <section className="weavy-section relative">
      {/* one wide grid band across the white zone */}
      <div className="grid-band" style={{ top: 24, height: 560 }} />

      {/* board area; no rounded card around everything */}
      <div
        ref={wrapRef}
        className="relative mx-auto max-w-[1360px] min-h-[720px] sm:min-h-[860px] px-4 py-16"
        style={{ zIndex: 1 }}
      >
        {/* headline row (kept minimal to match your screenshot spacing) */}
        <div className="mb-6">
          <h2 className="text-3xl sm:text-4xl font-semibold">Pick what you want to build</h2>
          <p className="text-sm text-muted-foreground mt-1">Move the nodes. Click one to open its spec sheet.</p>
        </div>

        {/* wires under nodes */}
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          <defs>
            <radialGradient id="nub" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </radialGradient>
            {/* soft thread gradient */}
            <linearGradient id="wire" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#b9c2cc" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>

          {LINKS.map(([aId, aEdge, bId, bEdge], i) => {
            const A = map[aId], B = map[bId];
            if (!A || !B) return null;
            const pa = anchors(A)[aEdge];
            const pb = anchors(B)[bEdge];
            const d = wirePath(pa, pb);
            return (
              <g key={i} style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.08))" }}>
                {/* body */}
                <path d={d} stroke="url(#wire)" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                {/* inner highlight (thread glint) */}
                <path d={d} stroke="#ffffff" strokeWidth={1} fill="none" strokeLinecap="round" strokeOpacity={0.35} strokeDasharray="2 10" />
                {/* endpoints */}
                <circle cx={pa.x} cy={pa.y} r={5} fill="url(#nub)" stroke="#94a3b8" strokeWidth={1} />
                <circle cx={pb.x} cy={pb.y} r={5} fill="url(#nub)" stroke="#94a3b8" strokeWidth={1} />
              </g>
            );
          })}
        </svg>

        {/* nodes */}
        {nodes.map((n) => (
          <div
            key={n.id}
            data-node-id={n.id}
            className="node-card select-none"
            style={{ left: n.x, top: n.y, width: n.w, height: n.h, position: "absolute" }}
          >
            {/* small nubs on sides so cables feel plugged-in */}
            <div className="nub nub-l" />
            <div className="nub nub-r" />

            <button
              className="w-full h-full rounded-full border bg-white/80 hover:bg-white shadow-sm flex items-center justify-between px-4 text-sm font-medium btn-magnetic"
              onClick={() => {
                // open a spec sheet later; for now just log
                console.log("open spec:", n.id);
              }}
            >
              <span>{n.title}</span>
              <span>→</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
