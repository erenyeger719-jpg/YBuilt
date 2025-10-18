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

const SCALE = 2;          // 2× node size
const BAND_TOP = 140;
const BAND_HEIGHT = 560;
const CANVAS_BOTTOM = 360; // extra space under band for the bottom node row

export default function WeavyBoard() {
  const wrapRef = useRef<HTMLDivElement>(null);

  // doubled sizes (w/h only). wire stroke comes from CSS, unchanged.
  const [nodes, setNodes] = useState<NodeT[]>([
    { id: "prompt",  label: "Prompt",  w: 220 * SCALE, h: 160 * SCALE, x: 0, y: 0, originX: 0, originY: 0 },
    { id: "weaver",  label: "Weaver",  w: 240 * SCALE, h: 180 * SCALE, x: 0, y: 0, originX: 0, originY: 0 },
    { id: "preview", label: "Preview", w: 260 * SCALE, h: 180 * SCALE, x: 0, y: 0, originX: 0, originY: 0 },
    { id: "launch",  label: "Launch",  w: 220 * SCALE, h: 160 * SCALE, x: 0, y: 0, originX: 0, originY: 0 },
  ]);

  // center + space nodes on mount and resize
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const layout = () => {
      const rect = el.getBoundingClientRect();
      const W = rect.width;
      const cx = W / 2;
      const midY = BAND_TOP + BAND_HEIGHT / 2;

      const row = [0, 1, 2];           // indices for the middle row
      const gapMin = 28;
      const gapBase = 56;

      // compute total width for the first row and pick a gap that fits
      const rowWidths = row.map(i => nodes[i].w);
      let gap = gapBase;
      const sumW = rowWidths.reduce((a, b) => a + b, 0);
      // if tight, shrink the gap but never below gapMin
      while (sumW + gap * (row.length - 1) > W - 48 && gap > gapMin) gap -= 4;

      const totalRowWidth = sumW + gap * (row.length - 1);
      let xLeft = Math.round(cx - totalRowWidth / 2);

      // place row nodes left→right
      const placed = [...nodes];
      row.forEach((i) => {
        const n = placed[i];
        const x = xLeft;
        const y = Math.round(midY - n.h / 2);
        placed[i] = { ...n, x, y, originX: x, originY: y };
        xLeft += n.w + gap;
      });

      // bottom node centered under the weaver
      const bottomIdx = 3; // "launch"
      const topIdx = 1;    // "weaver"
      {
        const top = placed[topIdx];
        const n = placed[bottomIdx];
        const x = Math.round(top.x + top.w / 2 - n.w / 2);
        const y = Math.round(midY + top.h / 2 + 80); // vertical gap under row
        placed[bottomIdx] = { ...n, x, y, originX: x, originY: y };
      }

      setNodes(placed);
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drag
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    const n = nodes.find(n => n.id === id)!;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, ox: e.clientX - n.x, oy: e.clientY - n.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setNodes(ns =>
      ns.map(n => (n.id === drag.id ? { ...n, x: e.clientX - drag.ox, y: e.clientY - drag.oy } : n))
    );
  };

  // patched spring-back
  const onPointerUp = () => {
    if (!drag) return;
    const id = drag.id;
    setDrag(null);

    // snapshot at release
    const current = nodes.find(n => n.id === id)!;
    const ix = current.x, iy = current.y, ox = current.originX, oy = current.originY;

    const easeOutBack = (p: number) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      // stable, no pre-decrement
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    };

    const t0 = performance.now();
    const duration = 380;

    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const q = easeOutBack(p);

      setNodes(ns =>
        ns.map(n =>
          n.id !== id
            ? n
            : { ...n, x: Math.round(ix + (ox - ix) * q), y: Math.round(iy + (oy - iy) * q) }
        )
      );

      if (p < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  // wire geometry
  const anchor = (n: NodeT, side: "l" | "r" | "t" | "b") => {
    if (side === "l") return { x: n.x, y: n.y + n.h / 2 };
    if (side === "r") return { x: n.x + n.w, y: n.y + n.h / 2 };
    if (side === "t") return { x: n.x + n.w / 2, y: n.y };
    return { x: n.x + n.w / 2, y: n.y + n.h };
  };
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = Math.abs(b.x - a.x);
    const c = Math.max(60, dx * 0.35);
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
        {/* single band */}
        <div className="grid-band" style={{ top: `${BAND_TOP}px`, height: `${BAND_HEIGHT}px` }} />

        {/* wires (stroke width stays from CSS) */}
        <svg className="absolute inset-0 wire-thread" width="100%" height="100%" viewBox={`0 0 1200 ${canvasH}`} preserveAspectRatio="none">
          <defs>
            <filter id="threadShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0b0f14" floodOpacity="0.18" />
            </filter>
          </defs>
          {map.prompt && map.weaver  && <path d={curve(anchor(map.prompt,  "r"), anchor(map.weaver,  "l"))} />}
          {map.weaver && map.preview && <path d={curve(anchor(map.weaver,  "r"), anchor(map.preview, "l"))} />}
          {map.weaver && map.launch  && <path d={curve(anchor(map.weaver,  "b"), anchor(map.launch,  "t"))} />}
        </svg>

        {/* nodes (2×) */}
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
