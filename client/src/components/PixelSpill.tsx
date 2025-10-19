'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Props = {
  top: number;          // px from top of weavy-canvas
  height: number;       // px height of spill strip
  cell?: number;        // px grid cell (default 17 = 16 gap + 1 line)
  fadeRows?: number;    // rows to fade before nodes begin
  density?: number;     // 0..1
  colors?: string[];    // palette
  seed?: number;        // deterministic scatter
};

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (1664525 * s + 1013904223) >>> 0) / 0xffffffff;
}

export default function PixelSpill({
  top,
  height,
  cell = 17,
  fadeRows = 6,
  density = 0.95,
  colors = ['#0b0c10', '#14161a', '#1f2329', '#2b3037', '#363c44', '#4a515a'],
  seed = 20251019,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1200);

  // measure available width (full bleed)
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.ceil(el.clientWidth)));
    ro.observe(el);
    setW(Math.ceil(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // precompute rects
  const rects = React.useMemo(() => {
    const rnd = lcg(seed);
    const cols = Math.ceil(w / cell) + 2;
    const usableH = height - fadeRows * cell; // bottom part will be faded anyway

    const nodes: Array<JSX.Element> = [];
    for (let i = 0; i < cols; i++) {
      const x = i * cell;

      // crown “depth” varies per column
      const base = 0.38 * usableH;
      const varRange = 0.28 * usableH;
      const crownDepth = Math.max(cell, Math.min(usableH, base + varRange * (rnd() * 2 - 1)));

      const rows = Math.floor(crownDepth / cell);

      for (let r = 0; r < rows; r++) {
        // denser near the top, sparser as it falls
        const falloff = 1 - r / (rows + 1);
        const chance = density * (0.60 + 0.40 * falloff);

        if (rnd() < chance) {
          const y = r * cell;
          const color = colors[Math.floor(rnd() * colors.length)] ?? colors[0];

          // leave 1px gutters so the spill sits “on” the grid
          const g = 1;
          nodes.push(
            <rect
              key={`${i}:${r}`}
              x={x + g}
              y={y + g}
              width={cell - g}
              height={cell - g}
              fill={color}
            />
          );
        }
      }
    }
    return nodes;
  }, [w, cell, height, fadeRows, density, colors, seed]);

  const fadePx = Math.max(0, fadeRows * cell);

  return (
    <div
      ref={wrapRef}
      className="pixel-spill"
      style={{
        top,
        height,
        // fade out before nodes start
        WebkitMaskImage: `linear-gradient(to bottom, #000 ${height - fadePx}px, transparent 100%)`,
        maskImage: `linear-gradient(to bottom, #000 ${height - fadePx}px, transparent 100%)`,
        zIndex: 1,
      }}
      aria-hidden
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        role="presentation"
        style={{ display: 'block' }}
      >
        {rects}
      </svg>
    </div>
  );
}
