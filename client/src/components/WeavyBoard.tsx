import { useEffect, useRef, useState } from "react";

/* ---------- types ---------- */
type Pt = { x: number; y: number };
type Node = { id: string; title: string; x: number; y: number; w: number; h: number };

const GRID = 16; // “one space”
const snap = (v: number) => Math.round(v / GRID) * GRID;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/* Thready cubic path with gentle sag + direction-aware handles */
function wirePath(a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const bend = Math.min(120, dist * 0.25);      // how curvy
  const dir = Math.sign(dx || 1);               // left/right direction
  const kx = Math.max(40, Math.abs(dx) * 0.28); // horizontal handle
  const cx1 = a.x + dir * kx;
  const cx2 = b.x - dir * kx;
  const sag = Math.min(80, dist * 0.12);        // vertical sag (feels like thread)
  const cy1 = a.y + dy * 0.10 + sag * 0.40;
  const cy2 = b.y - dy * 0.10 + sag * 0.40;
  return `M ${a.x} ${a.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${b.x} ${b.y}`;
}

function anchors(n: Node) {
  return {
    l: { x: n.x, y: n.y + n.h / 2 },
    r: { x: n.x + n.w, y: n.y + n.h / 2 },
    t: { x: n.x + n.w / 2, y: n.y },
    b: { x: n.x + n.w / 2, y: n.y + n.h },
  };
}

/* ---------- initial nodes ---------- */
const START: Node[] = [
  { id: "portfolio", title: "Portfolio",       x: 220,  y: 120, w: 152, h: 48 },
  { id: "blog",      title: "Blog / Magazine", x: 460,  y: 90,  w: 192, h: 48 },
  { id: "shop",      title: "Shop",            x: 780,  y: 120, w: 112, h: 48 },
  { id: "saas",      title: "SaaS Landing",    x: 980,  y: 100, w: 168, h: 48 },
  { id: "dashboard", title: "Dashboard",       x: 300,  y: 240, w: 148, h: 48 },
  { id: "docs",      title: "Docs",            x: 620,  y: 240, w: 104, h: 48 },
  { id: "mobile",    title: "Mobile Shell",    x: 900,  y: 260, w: 164, h: 48 },
  { id: "booking",   title: "Booking",         x: 240,  y: 380, w: 128, h: 48 },
  { id: "education", title: "Education",       x: 520,  y: 400, w: 144, h: 48 },
  { id: "community", title: "Community",       x: 760,  y: 440, w: 152, h: 48 },
  { id: "aiapp",     title: "AI App",          x: 1040, y: 460, w: 116, h: 48 },
];

/* from → to (which anchor on each) */
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

/* ---------- easing for yo-yo snap back ---------- */
// easeOutBack (overshoots a touch, then settles)
function easeOutBack(x: number) {
  const c1 = 1.70158; const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export default function WeavyBoard() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>(START);

  // remember home slots for yo-yo
  const home = useRef<Record<string, Pt>>(
    Object.fromEntries(START.map(n => [n.id, { x: n.x, y: n.y }]))
  );

  // drag state
  const dragId = useRef<string | null>(null);
  const grabOffset = useRef<Pt>({ x: 0, y: 0 });

  // anim raf (so we can cancel if user grabs mid-flight)
  const raf = useRef<number | null>(null);

  // start drag
  useEffect(() => {
    const el = wrapRef.current!;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]');
      if (!target) return;
      const id = target.dataset.nodeId!;
      const rect = el.getBoundingClientRect();
      const n = nodes.find(n => n.id === id);
      if (!n) return;

      // cancel any running yo-yo on this node
      if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null; }

      dragId.current = id;
      grabOffset.current = { x: e.clientX - rect.left - n.x, y: e.clientY - rect.top - n.y };
      (target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragId.current) return;
      const rect = el.getBoundingClientRect();
      const id = dragId.current;
      setNodes(prev => prev.map(n => {
        if (n.id !== id) return n;
        // track under pointer, snap to the 16px grid while moving
        let nx = e.clientX - rect.left - grabOffset.current.x;
        let ny = e.clientY - rect.top - grabOffset.current.y;
        nx = clamp(snap(nx), 0, rect.width - n.w);
        ny = clamp(snap(ny), 0, rect.height - n.h);
        return { ...n, x: nx, y: ny };
      }));
    };

    const onUp = () => {
      if (!dragId.current) return;
      const id = dragId.current;
      dragId.current = null;

      // spring back to home (yo-yo)
      const n0 = nodes.find(n => n.id === id);
      const to = home.current[id];
      if (!n0 || !to) return;

      const from = { x: n0.x, y: n0.y };
      const duration = 560; // ms
      let t0: number | null = null;

      const step = (ts: number) => {
        if (dragId.current) return; // user grabbed again
        if (t0 == null) t0 = ts;
        const p = Math.min(1, (ts - t0) / duration);
        const e = easeOutBack(p);
        const nx = from.x + (to.x - from.x) * e;
        const ny = from.y + (to.y - from.y) * e;
        setNodes(prev => prev.map(n => (n.id === id ? { ...n, x: nx, y: ny } : n)));
        if (p < 1) raf.current = requestAnimationFrame(step);
        else raf.current = null;
      };
      raf.current = requestAnimationFrame(step);
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [nodes]);

  const map = Object.fromEntries(nodes.map(n => [n.id, n])) as Record<string, Node>;

  return (
    <section className="weavy-section relative">
      {/* one full-width horizontal grid band */}
      <div className="grid-band" style={{ top: 24, height: 560 }} />

      <div
        ref={wrapRef}
        className="relative mx-auto max-w-[1360px] min-h-[720px] sm:min-h-[860px] px-4 py-16"
        style={{ zIndex: 1 }}
      >
        <div className="mb-6">
          <h2 className="text-3xl sm:text-4xl font-semibold">Pick what you want to build</h2>
          <p className="text-sm text-muted-foreground mt-1">Move the nodes. Release to yo-yo. Click to open a spec.</p>
        </div>

        {/* thread wires */}
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          <defs>
            <radialGradient id="nub" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </radialGradient>
            <linearGradient id="wire" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#b9c2cc" />
              <stop offset="50%"  stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>

          {LINKS.map(([aId, aEdge, bId, bEdge], i) => {
            const A = map[aId], B = map[bId];
            if (!A || !B) return null;
            const pa = anchors(A)[aEdge];
            const pb = anchors(B)[bEdge];
            const d = wirePath(pa, pb);
            const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }; // bead

            return (
              <g key={i} style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.08))" }}>
                <path d={d} stroke="url(#wire)" strokeWidth={2.6} fill="none" strokeLinecap="round" />
                {/* subtle inner glint for “thread” */}
                <path d={d} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} fill="none" strokeLinecap="round" strokeDasharray="2 10" />
                {/* endpoints */}
                <circle cx={pa.x} cy={pa.y} r={5} fill="url(#nub)" stroke="#94a3b8" strokeWidth={1} />
                <circle cx={pb.x} cy={pb.y} r={5} fill="url(#nub)" stroke="#94a3b8" strokeWidth={1} />
                {/* little bead in the middle */}
                <circle cx={mid.x} cy={mid.y} r={3} fill="#e5e7eb" stroke="#94a3b8" strokeWidth={0.75} opacity={0.6} />
              </g>
            );
          })}
        </svg>

        {/* nodes (draggable pills with magnetic feel via your utility) */}
        {nodes.map((n) => (
          <div
            key={n.id}
            data-node-id={n.id}
            className="node-card select-none"
            style={{ left: n.x, top: n.y, width: n.w, height: n.h, position: "absolute" }}
          >
            {/* little “plug” nubs so the wire feels connected */}
            <div className="nub nub-l" />
            <div className="nub nub-r" />

            <button
              className="w-full h-full rounded-full border bg-white/80 hover:bg-white shadow-sm flex items-center justify-between px-4 text-sm font-medium btn-magnetic"
              onClick={() => {
                // TODO: open mini spec sheet
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
