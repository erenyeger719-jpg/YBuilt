// client/src/components/PixelSpill.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  top?: number;          // px from top
  height: number;        // px total spill height
  cell?: number;         // px tile size
  solidRows?: number;    // always-opaque rows at the top
  fadeRows?: number;     // rows that fade near the bottom
  density?: number;      // 0..1, how busy the crown is
  color?: string;        // pixel color
  seed?: number;         // deterministic RNG
};

function rng(seed: number) {
  // xorshift32 — tiny deterministic RNG
  let x = seed || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    // map to [0,1)
    return ((x >>> 0) % 100000) / 100000;
  };
}

export default function PixelSpill({
  top = 0,
  height,
  cell = 9,
  solidRows = 2,
  fadeRows = 9,
  density = 1.0,
  color = '#000',
  seed = 1,
}: Props) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setW(entry.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const { cols, rows, tiles } = useMemo(() => {
    const cols = Math.max(1, Math.ceil(w / cell));
    const rows = Math.max(1, Math.ceil(height / cell));
    const r = rng(seed + rows * 31 + cols * 17);

    const tiles: Array<{ x: number; y: number; a: number }> = [];

    for (let c = 0; c < cols; c++) {
      // each column gets a drip depth
      const base = 0.25 + r() * 0.55; // how far down this column goes
      const dripEnd = Math.min(rows, Math.max(solidRows + 2, Math.floor(rows * base)));

      for (let y = 0; y < dripEnd; y++) {
        // sparsity: more holes as we go down
        const holeProb = Math.min(0.55, (y / rows) * (0.35 + 0.25 * r())) / density;
        if (y >= solidRows && r() < holeProb) continue; // a gap

        // per-row opacity (fade only near the bottom of THIS column)
        let a = 1;
        const fadeStart = Math.max(solidRows, dripEnd - fadeRows);
        if (y >= fadeStart) {
          a = 1 - (y - fadeStart + 1) / Math.max(1, (dripEnd - fadeStart));
        }
        tiles.push({ x: c, y, a });
      }
    }

    return { cols, rows, tiles };
  }, [w, cell, height, solidRows, fadeRows, density, seed]);

  const svgW = cols * cell;
  const svgH = rows * cell;

  return (
    <svg
      ref={ref}
      className="pixel-spill"
      width="100%"
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', top, display: 'block', zIndex: 1 }}
      aria-hidden
    >
      {/* draw only tiles; NO full-width fade veil */}
      {tiles.map((t, i) => (
        <rect
          key={i}
          x={t.x * cell}
          y={t.y * cell}
          width={cell - 1}         // 1px gap so grid can peek through
          height={cell - 1}
          fill={color}
          fillOpacity={t.a}
          shapeRendering="crispEdges"
        />
      ))}
    </svg>
  );
}

