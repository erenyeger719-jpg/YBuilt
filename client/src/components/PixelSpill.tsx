'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  top: number;          // px from section top
  height: number;       // px tall (match the grid band)
  cell?: number;        // grid cell size (gap + 1px line). default 17
  fadeRows?: number;    // how many rows fade to 0 at the bottom
  density?: number;     // 0..1: how filled the crown looks
  seed?: number;        // deterministic layout
  colors?: string[];    // optional palette; defaults to graphite steps
};

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function PixelSpill({
  top,
  height,
  cell = 17,
  fadeRows = 6,
  density = 0.95,
  seed = 20251019,
  colors,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1200);

  // measure width so we know column count
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.ceil(el.clientWidth)));
    ro.observe(el);
    setW(Math.ceil(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const palette =
    colors && colors.length
      ? colors
      : ['#0a0a0b', '#13161a', '#1c2126', '#262c33']; // graphite steps from hero

  const { cols, rows, rects } = useMemo(() => {
    const cols = Math.ceil(w / cell);
    const rows = Math.floor(height / cell);
    const rand = mulberry32(seed);

    // generate a wiggly skyline via constrained random walk
    let h = Math.floor(rows * 0.25 + rand() * rows * 0.2); // start modest
    const rects: { x: number; y: number; fill: string; a: number }[] = [];

    for (let c = 0; c < cols; c++) {
      // nudge height −2..+2 with bias upward early, then cool off
      const bias = c < cols * 0.55 ? 0.6 : 0.45;
      const step =
        (rand() < bias ? 1 : -1) * (rand() < 0.45 ? 2 : 1); // small chunky moves
      h = Math.max(1, Math.min(rows - fadeRows - 1, h + step));

      // carve the column: from top (row 0) down to h
      for (let r = 0; r < h; r++) {
        if (rand() > density) continue; // holes

        // fade near the bottom edge so it dies before nodes
        const fadeStart = Math.max(0, h - fadeRows);
        const fadeT = r <= fadeStart ? 0 : (r - fadeStart) / Math.max(1, fadeRows);
        const alpha = 1 - fadeT; // 1 -> 0

        // slight palette jitter (darker near the top)
        const shadeIndex = Math.min(
          palette.length - 1,
          Math.floor((r / Math.max(1, rows)) * (palette.length + 0.5))
        );

        rects.push({
          x: c * cell,
          y: r * cell,
          fill: palette[shadeIndex],
          a: alpha,
        });
      }
    }

    return { cols, rows, rects };
  }, [w, height, cell, fadeRows, density, seed, palette]);

  return (
    <div
      ref={hostRef}
      className="pixel-spill"
      style={{ top, height, /* left/right handled by .pixel-spill */ }}
      aria-hidden
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${cols * cell} ${rows * cell}`} preserveAspectRatio="none">
        {/* top mask: slightly heavier at the very top for a “crown” */}
        <defs>
          <linearGradient id="ps-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.98" />
            <stop offset="0.2" stopColor="white" stopOpacity="0.98" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="ps-mask">
            <rect width="100%" height="100%" fill="url(#ps-fade)" />
          </mask>
        </defs>

        <g mask="url(#ps-mask)">
          {rects.map((r, i) => (
            <rect
              key={i}
              x={r.x}
              y={r.y}
              width={cell - 1}      // respect the 1px grid line
              height={cell - 1}
              fill={r.fill}
              opacity={r.a}
              shapeRendering="crispEdges"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
