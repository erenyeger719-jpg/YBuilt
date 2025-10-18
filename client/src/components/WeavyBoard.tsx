import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/** 16px grid; the band is just a big background—nodes sit above it */
const CELL = 16;

/** Node shape for our storyboard */
type NodeDef = {
  id: string;
  label: string;                // small caption on the node
  w: number;                    // width (px)
  h: number;                    // height (px)
  x: number;                    // initial x (px)
  y: number;                    // initial y (px)
  kind: "image" | "video" | "text";
};

/** Tutorial storyboard nodes (prompt → plan → theme/sections/data → preview → deploy) */
const INITIAL_NODES: NodeDef[] = [
  { id: "prompt",  label: "PROMPT",        w: 300, h: 160, x: 140,  y: 80,  kind: "text"  },
  { id: "plan",    label: "PLAN",          w: 360, h: 200, x: 520,  y: 60,  kind: "text"  },
  { id: "theme",   label: "THEME",         w: 260, h: 180, x: 980,  y: 90,  kind: "image" },
  { id: "sections",label: "SECTIONS",      w: 320, h: 220, x: 330,  y: 320, kind: "image" },
  { id: "data",    label: "DATA",          w: 260, h: 180, x: 720,  y: 300, kind: "image" },
  { id: "preview", label: "LIVE PREVIEW",  w: 420, h: 280, x: 1030, y: 320, kind: "video" },
  { id: "deploy",  label: "DEPLOY",        w: 320, h: 200, x: 1460, y: 260, kind: "image" },
];

/** Wires between node anchors (left/right/top/bottom) */
type Anchor = "L" | "R" | "T" | "B";
type Edge = { from: [string, Anchor]; to: [string, Anchor]; sag?: number };

const EDGES: Edge[] = [
  { from: ["prompt", "R"],  to: ["plan", "L"],    sag: 60 },
  { from: ["plan", "R"],    to: ["theme", "L"],   sag: 80 },
  { from: ["plan", "B"],    to: ["sections", "T"],sag: 70 },
  { from: ["plan", "R"],    to: ["data", "T"],    sag: 70 },
  { from: ["sections","R"], to: ["preview","L"],  sag: 90 },
  { from: ["data","R"],     to: ["preview","T"],  sag: 90 },
  { from: ["preview","R"],  to: ["deploy","L"],   sag: 120 },
];

type Box = { x: number; y: number; w: number; h: number };

function anchorPoint(box: Box, side: Anchor) {
  switch (side) {
    case "L": return { x: box.x,            y: box.y + box.h / 2 };
    case "R": return { x: box.x + box.w,    y: box.y + box.h / 2 };
    case "T": return { x: box.x + box.w/2,  y: box.y };
    case "B": return { x: box.x + box.w/2,  y: box.y + box.h };
  }
}

/** Smooth cubic path that feels like a “thread” with sag */
function threadPath(ax: number, ay: number, bx: number, by: number, sag = 60) {
  const dx = bx - ax;
  const dy = by - ay;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;

  // normal vector to (dx,dy)
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;

  const c1x = ax + dx * 0.25 + nx * sag;
  const c1y = ay + dy * 0.25 + ny * sag;
  const c2x = ax + dx * 0.75 + nx * sag;
  const c2y = ay + dy * 0.75 + ny * sag;

  return {
    d: `M ${ax},${ay} C ${c1x},${c1y} ${c2x},${c2y} ${bx},${by}`,
    mid: { x: mx + nx * sag, y: my + ny * sag }, // for the “bead”
  };
}

export default function WeavyBoard() {
  const bandRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // live node positions (for drag)
  const [nodes, setNodes] = useState(() =>
    INITIAL_NODES.map(n => ({ ...n, x: n.x, y: n.y }))
  );

  // origin map for yo-yo
  const origins = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    INITIAL_NODES.forEach(n => map.set(n.id, { x: n.x, y: n.y }));
    return map;
  }, []);

  // drag state
  const dragRef = useRef<{ id: string; ox: number; oy: number; mx: number; my: number } | null>(null);

  // helpers
  const nodeRect = (n: NodeDef) => ({ x: n.x, y: n.y, w: n.w, h: n.h });

  // snap-to grid while dragging (still smooth)
  const snap = (v: number) => Math.round(v / CELL) * CELL;

  // pointer handlers
  const onPointerDown = (e: React.PointerEvent, id: string) => {
    const n = nodes.find(n => n.id === id)!;
    dragRef.current = { id, ox: n.x, oy: n.y, mx: e.clientX, my: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { id, ox, oy, mx, my } = dragRef.current;
    const dx = e.clientX - mx;
    const dy = e.clientY - my;
    setNodes(prev =>
      prev.map(n => n.id === id ? { ...n, x: snap(ox + dx), y: snap(oy + dy) } : n)
    );
  };

  const springTo = (id: string, target: { x: number; y: number }) => {
    // simple critically-damped spring / ease-out
    let vx = 0, vy = 0;
    const k = 0.16;      // stiffness
    const d = 0.88;      // damping
    const tick = () => {
      setNodes(prev => {
        const n = prev.find(n => n.id === id)!;
        const ax = (target.x - n.x) * k;
        const ay = (target.y - n.y) * k;
        vx = (vx + ax) * d;
        vy = (vy + ay) * d;
        const nx = n.x + vx;
        const ny = n.y + vy;
        const done = Math.hypot(target.x - nx, target.y - ny) < 0.6 && Math.hypot(vx, vy) < 0.6;
        if (done) {
          return prev.map(m => m.id === id ? { ...m, x: target.x, y: target.y } : m);
        }
        requestAnimationFrame(tick);
        return prev.map(m => m.id === id ? { ...m, x: nx, y: ny } : m);
      });
    };
    requestAnimationFrame(tick);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    // always yo-yo back to original spot
    const target = origins.get(drag.id)!;
    springTo(drag.id, target);
    dragRef.current = null;
  };

  /** Band height: big, so you get plenty of grid lines */
  useLayoutEffect(() => {
    const el = bandRef.current;
    if (el) {
      // Fill a generous band (desktop ~720px; mobile ~560px)
      const h = Math.max(560, Math.min(820, Math.round(window.innerHeight * 0.7)));
      el.style.top = "0px";
      el.style.height = `${h}px`;
    }
  }, []);

  // Build a quick map for lookups
  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  // Compute edges
  const edges = useMemo(() => {
    return EDGES.map(({ from, to, sag }) => {
      const [fa, fs] = from; const [ta, ts] = to;
      const A = anchorPoint(nodeRect(byId[fa]), fs);
      const B = anchorPoint(nodeRect(byId[ta]), ts);
      const { d, mid } = threadPath(A.x, A.y, B.x, B.y, sag ?? 60);
      return { id: `${fa}-${ta}`, d, a: A, b: B, mid };
    });
  }, [byId]);

  return (
    <section className="weavy-section">
      {/* Full-width grid band underlay */}
      <div ref={bandRef} className="grid-band" />

      {/* SVG wires above the grid, below nodes */}
      <svg ref={svgRef} className="absolute inset-0 pointer-events-none" width="100%" height="820">
        <defs>
          <filter id="threadShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.12" />
          </filter>
        </defs>

        {edges.map(e => (
          <g key={e.id} className="wire-thread">
            <path d={e.d} />
            {/* end dots */}
            <circle cx={e.a.x} cy={e.a.y} r="5.5" className="wire-dot" />
            <circle cx={e.b.x} cy={e.b.y} r="5.5" className="wire-dot" />
            {/* mid “bead” */}
            <circle cx={e.mid.x} cy={e.mid.y} r="4" className="wire-bead" />
          </g>
        ))}
      </svg>

      {/* Nodes */}
      <div className="relative max-w-[1800px] mx-auto px-6 pt-10" style={{ height: 820 }}>
        {nodes.map(n => (
          <div
            key={n.id}
            className="node-card select-none"
            style={{ width: n.w, height: n.h, transform: `translate3d(${n.x}px, ${n.y}px, 0)` }}
            onPointerDown={(e) => onPointerDown(e, n.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* small label */}
            <div className="node-label">{n.label}</div>

            {/* Media / text placeholder (leave empty for you to drop assets) */}
            <div className="slot-media">
              <div className="placeholder">
                {n.kind === "text" ? "Text goes here" :
                 n.kind === "image" ? "Image placeholder" :
                 "Video placeholder"}
              </div>
            </div>

            {/* tiny anchor nubs so wires feel “plugged in” */}
            <div className="nub nub-l" />
            <div className="nub nub-r" />
            <div className="nub nub-t" />
            <div className="nub nub-b" />
          </div>
        ))}
      </div>
    </section>
  );
}
