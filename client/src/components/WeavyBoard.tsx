'use client';

import React, { useLayoutEffect, useRef, useState } from "react";

type NodeT = {
  id: string;
  label: string;
  w: number;
  h: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
};

const BAND_TOP = 120;         // grid band offset from top
const BAND_HEIGHT = 520;      // grid band height
const CANVAS_BOTTOM = 220;    // extra space under band

export default function WeavyBoard() {
  const wrapRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<NodeT[]>([
    { id: "prompt",  label: "Prompt",  w: 220, h: 160, x: 0, y: 0, originX: 0, originY: 0 },
    { id: "weaver",  label: "Weaver",  w: 240, h: 180, x: 0, y: 0, originX: 0, originY: 0 },
    { id: "preview", label: "Preview", w: 260, h: 180, x: 0, y: 0, originX: 0, originY: 0 },
    { id: "launch",  label: "Launch",  w: 220, h: 160, x: 0, y: 0, originX: 0, originY: 0 },
  ]);

  // Center nodes on mount + resize
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const layout = () => {
      const rect = el.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = BAND_TOP + BAND_HEIGHT / 2;

      // Offsets around the center (tweak freely)
      const offsets = [
        { x: -300, y: 0   }, // prompt
        { x:    0, y: 0   }, // weaver
        { x:  300, y: 0   }, // preview
        { x:    0, y: 210 }, // launch
      ];

      setNodes(ns =>
        ns.map((n, i) => {
          const x = Math.round(cx + offsets[i].x - n.w / 2);
          const y = Math.round(cy + offsets[i].y - n.h / 2);
          return { ...n, x, y, originX: x, originY: y };
        })
      );
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drag state
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    const n = nodes.find(n => n.id === id)!;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, ox: e.clientX - n.x, oy: e.clientY - n.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setNodes(ns =>
      ns.map(n =>
        n.id !== drag.id ? n : { ...n, x: e.clientX - drag.ox, y: e.clientY - drag.oy }
      )
    );
  };

  const onPointerUp = () => {
    if (!drag) return;
    const id = drag.id;
    setDrag(null);

    // Yo-yo (spring back to origin)
    const start = nodes.find(n => n.id === id)!;
    const ix = start.x, iy = start.y, ox = start.originX, oy = start.originY;
    const t0 = performance.now();
    const duration = 350;

    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      // easeOutBack
      const s = 1.70158;
      const q = (-p) * p * ((s + 1) * p + s) + 1;

      setNodes(ns =>
        ns.map(n =>
          n.id !== id
            ? n
            : { ...n, x: Math.round(ix + (ox - ix) * q), y: Math.round(iy + (oy - iy) * q) }
        )
      );
      if (q < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // Wire helpers
  const anchor = (n: NodeT, side: "l" | "r" | "t" | "b") => {
    if (side === "l") return { x: n.x, y: n.y + n.h / 2 };
    if (side === "r") return { x: n.x + n.w, y: n.y + n.h / 2 };
    if (side === "t") return { x: n.x + n.w / 2, y: n.y };
    return { x: n.x + n.w / 2, y: n.y + n.h };
  };
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = Math.abs(b.x - a.x);
    const c = Math.max(40, dx * 0.35);
    return `M ${a.x},${a.y} C ${a.x + c},${a.y} ${b.x - c},${b.y} ${b.x},${b.y}`;
  };

  const map = Object.fromEntries(nodes.map(n => [n.id, n]));
  const canvasH = BAND_TOP + BAND_HEIGHT + CANVAS_BOTTOM;

  return (
    <section className="weavy-section" style={{ overflow: "hidden", background: "#fff" }}>
      <div
        ref={wrapRef}
        className="relative mx-auto weavy-canvas"
        style={{ width: "100%", maxWidth: "1200px", height: `${canvasH}px` }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* SINGLE grid band (deletes the “below layer” duplicates) */}
        <div
          className="grid-band"
          style={{ top: `${BAND_TOP}px`, height: `${BAND_HEIGHT}px` }}
        />

        {/* Wires */}
        <svg
          className="absolute inset-0 wire-thread"
          width="100%"
          height="100%"
          viewBox={`0 0 1200 ${canvasH}`}
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="threadShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0b0f14" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* prompt -> weaver */}
          <path d={curve(anchor(map.prompt, "r"), anchor(map.weaver, "l"))} />
          {/* weaver -> preview */}
          <path d={curve(anchor(map.weaver, "r"), anchor(map.preview, "l"))} />
          {/* weaver -> launch */}
          <path d={curve(anchor(map.weaver, "b"), anchor(map.launch, "t"))} />
        </svg>

        {/* Nodes */}
        {nodes.map(n => (
          <div
            key={n.id}
            className="node-card select-none"
            style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
            onPointerDown={e => onPointerDown(e, n.id)}
          >
            <div className="node-label">{n.label}</div>
            <div className="slot-media">
              <div className="placeholder">drop image / video</div>
            </div>
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
