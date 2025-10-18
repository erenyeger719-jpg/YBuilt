import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Types */
type NodeType = "image" | "video" | "text" | "gallery" | "cta";
type Side = "l" | "r" | "t" | "b";
type NodeDef = {
  id: string;
  type: NodeType;
  title: string;
  x: number; y: number; w: number; h: number;
};
type Edge = {
  id: string;
  from: { id: string; side: Side };
  to:   { id: string; side: Side };
};

/** Helpers */
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function anchorXY(n: NodeDef, side: Side) {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  if (side === "l") return { x: n.x,        y: cy };
  if (side === "r") return { x: n.x + n.w,  y: cy };
  if (side === "t") return { x: cx,         y: n.y };
  return                  { x: cx,         y: n.y + n.h }; // "b"
}
function cubicPath(a: {x:number;y:number}, b: {x:number;y:number}) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const horiz = Math.abs(dx) >= Math.abs(dy);
  const k = clamp(Math.hypot(dx,dy) * 0.35, 60, 220);           // tension
  const sag = horiz ? Math.sign(dy||1) * Math.min(80, Math.abs(dy)*0.3) : 0; // gentle sag
  const c1 = horiz ? { x: a.x + Math.sign(dx)*k, y: a.y + sag } : { x: a.x, y: a.y + Math.sign(dy)*k };
  const c2 = horiz ? { x: b.x - Math.sign(dx)*k, y: b.y + sag } : { x: b.x, y: b.y - Math.sign(dy)*k };
  return `M ${a.x},${a.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
}

/** Draggable Weavy board */
export default function WeavyBoard() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOff, setDragOff] = useState({ x:0, y:0 });
  const [nodes, setNodes] = useState<NodeDef[]>([
    { id: "n1", type: "image",  title: "IMAGE — Stable Diffusion", x: 80,  y: 80,  w: 420, h: 340 },
    { id: "n2", type: "text",   title: "TEXT",                      x: 580, y: 120, w: 260, h: 120 },
    { id: "n3", type: "image",  title: "IMAGE — FLUX PRO 1.1",      x: 580, y: 300, w: 220, h: 230 },
    { id: "n4", type: "video",  title: "VIDEO — Slot",              x: 880, y: 80,  w: 380, h: 460 },
    { id: "n5", type: "gallery",title: "COLOR REFERENCE",           x: 120, y: 460, w: 300, h: 140 },
    { id: "n6", type: "cta",    title: "Create project",            x: 980, y: 580, w: 220, h: 80  },
  ]);
  const edges: Edge[] = useMemo(() => ([
    { id: "e1", from: { id: "n1", side: "r" }, to: { id: "n2", side: "l" } },
    { id: "e2", from: { id: "n2", side: "r" }, to: { id: "n4", side: "l" } },
    { id: "e3", from: { id: "n1", side: "b" }, to: { id: "n5", side: "t" } },
    { id: "e4", from: { id: "n3", side: "r" }, to: { id: "n4", side: "l" } },
  ]), []);

  // Magnetic only inside this section
  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    let last: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      const m = (e.target as HTMLElement)?.closest<HTMLElement>(".btn-magnetic");
      if (m) {
        last = m;
        const b = m.getBoundingClientRect();
        const x = e.clientX - (b.left + b.width/2);
        const y = e.clientY - (b.top  + b.height/2);
        const clamp = (v:number)=> Math.max(-24, Math.min(24, v));
        m.style.setProperty("--tx", clamp(x*0.15) + "px");
        m.style.setProperty("--ty", clamp(y*0.15) + "px");
      } else if (last) {
        last.style.setProperty("--tx","0px");
        last.style.setProperty("--ty","0px");
        last = null;
      }
    };
    const onLeave = () => { if (last) { last.style.setProperty("--tx","0px"); last.style.setProperty("--ty","0px"); last = null; } };
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave, { passive: true });
    return () => { root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerleave", onLeave); };
  }, []);

  /** Dragging */
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragId || !wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setNodes(ns => ns.map(n => {
        if (n.id !== dragId) return n;
        const nx = clamp(e.clientX - r.left - dragOff.x, 20, r.width - n.w - 20);
        const ny = clamp(e.clientY - r.top  - dragOff.y,  8, r.height - n.h - 8);
        return { ...n, x: nx, y: ny };
      }));
    }
    function onUp() { setDragId(null); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragId, dragOff]);

  return (
    <section className="weavy-section relative">
      {/* NEW: one wide grid band across the section */}
      <div
        className="grid-band absolute left-0 right-0"
        style={{
          top: 24,   // nudge down under the hero lip
          height: 560,
        }}
      />

      <div ref={wrapRef} className="relative mx-auto max-w-[1280px] min-h-[720px] sm:min-h-[840px] px-4 py-16">
        {/* SVG wires */}
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          <defs>
            <linearGradient id="wireGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stopColor="#9CA3AF" stopOpacity=".55"/>
              <stop offset="50%" stopColor="#CBD5E1" stopOpacity=".85"/>
              <stop offset="100%" stopColor="#9CA3AF" stopOpacity=".55"/>
            </linearGradient>
            <filter id="wireBlur" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>

          {edges.map((e) => {
            const a = nodes.find(n => n.id === e.from.id)!;
            const b = nodes.find(n => n.id === e.to.id)!;
            const p1 = anchorXY(a, e.from.side);
            const p2 = anchorXY(b, e.to.side);
            const d = cubicPath(p1, p2);
            return (
              <g key={e.id}>
                {/* soft shadow/body */}
                <path d={d} stroke="#0000001A" strokeWidth={8} fill="none" strokeLinecap="round" filter="url(#wireBlur)"/>
                {/* cable */}
                <path d={d} stroke="url(#wireGrad)" strokeWidth={2.6} fill="none" strokeLinecap="round"/>
                {/* inner glints */}
                <path d={d} stroke="#ffffff" strokeWidth={1.1} fill="none" strokeLinecap="round"
                      strokeDasharray="10 14" opacity=".65"/>
                {/* end dots */}
                {[p1, p2].map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={7.5} fill="#fff" stroke="#CBD5E1" strokeWidth={2}/>
                    <circle cx={p.x} cy={p.y} r={2.5} fill="#94A3B8"/>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((n) => (
          <div
            key={n.id}
            className="node-card"
            style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
            onPointerDown={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setDragId(n.id);
              setDragOff({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
          >
            <div className="node-title">{n.title}</div>

            {/* Slot content variations */}
            {n.type === "text" && (
              <div className="p-3 text-xs leading-relaxed text-neutral-700">
                A Great-Tailed Grackle bird is flying from the background and
                seating on the model’s shoulder slowly and barely moves. The model
                looks at the camera, then bird flies away. <em>Cinematic.</em>
              </div>
            )}

            {n.type === "image" && (
              <div className="slot-media">
                {/* leave blank area for you to drop image later */}
                <div className="placeholder">Add image</div>
              </div>
            )}

            {n.type === "video" && (
              <div className="slot-media">
                <div className="placeholder">Add video</div>
              </div>
            )}

            {n.type === "gallery" && (
              <div className="slot-media aspect-[16/7]">
                <div className="placeholder">Add reference</div>
              </div>
            )}

            {n.type === "cta" && (
              <div className="p-4">
                <Button className="btn-magnetic w-full">Create project</Button>
                <div className="text-[11px] text-neutral-500 mt-2">Beginner → Pro → Business</div>
              </div>
            )}

            {/* anchor nubs (visual) */}
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
