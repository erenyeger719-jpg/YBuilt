// client/src/components/PixelSpill.tsx
'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

type Props = {
  top?: number;       // px from the top of the band
  height: number;     // px height of the spill zone
  cell?: number;      // px grid step (default 9 => half of the old look)
  fadeRows?: number;  // how many rows fade to 0 near the bottom
  solidRows?: number; // first N rows fully filled
  density?: number;   // 0..1 baseline “fullness”
  color?: string;     // tile + stroke color
  seed?: number;      // deterministic random
  className?: string;
};

// tiny deterministic RNG
function rng(seed: number) {
  let t = seed + 0x6D2B79F5;
  return () => ((t = Math.imul(t ^ (t >>> 15), 1 | t)) >>> 0) / 4294967296;
}

export default function PixelSpill({
  top = 0,
  height,
  cell = 9,              // half-size tiles
  fadeRows = 9,          // longer fade
  solidRows = 2,         // two full black rows
  density = 1.0,         // fuller crown
  color = '#000',        // pure black
  seed = 20251019,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  // measure width so the SVG grid matches the container
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const grid = useMemo(() => {
    if (!w) return null;

    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(height / cell);
    const rand = rng(seed);

    // base & extra depth (in rows) per column
    const base = Math.floor(rows * 0.35);             // enough to read as a band
    const extraMax = Math.floor(rows * 0.55);         // spill depth
    const tendrilChance = 0.24;

    const depth: number[] = new Array(cols).fill(0).map(() =>
      base + Math.floor(extraMax * (rand() ** 0.8) * density)
    );

    // grow occasional tendrils for that “drippy” silhouette
    for (let c = 0; c < cols; c++) {
      if (rand() < tendrilChance) {
        const len = 2 + Math.floor(6 * rand());
        for (let i = 0; i < len; i++) {
          const k = c + i;
          if (k < cols) depth[k] = Math.max(depth[k], base + Math.floor(extraMax * rand()));
        }
      }
    }

    // build boolean cells (filled or not)
    const cells: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r < solidRows) { cells[r][c] = true; continue; }
        if (r < depth[c]) {
          // a few micro-holes so it doesn’t look like a hard bar
          const hole = rand() < (0.04 + 0.06 * (r / rows));
          cells[r][c] = !hole;
        }
      }
    }

    return { cols, rows, cells };
  }, [w, cell, height, solidRows, density, seed]);

  if (!grid) {
    return (
      <div
        ref={wrapRef}
        className={className}
        style={{ position: 'absolute', top, left: 0, right: 0, height }}
      />
    );
  }

  const { cols, rows, cells } = grid;
  const svgW = cols * cell;
  const svgH = rows * cell;

  // alpha by row => slow fade toward the nodes
  const fadeStart = Math.max(0, rows - fadeRows);
  const alpha = (r: number) => (r < fadeStart ? 1 : 1 - (r - fadeStart + 1) / (fadeRows + 1));

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: 'absolute', top, left: 0, right: 0, height }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
        {cells.map((row, ri) => {
          const a = alpha(ri);
          if (a <= 0) return null;
          return row.map((on, ci) =>
            on ? (
              <rect
                key={`${ri}-${ci}`}
                x={ci * cell + 0.5}
                y={ri * cell + 0.5}
                width={cell - 1}
                height={cell - 1}
                fill={color}
                fillOpacity={a}
                stroke={color}          // black “grid” lines
                strokeOpacity={a}
                strokeWidth={1}
              />
            ) : null
          );
        })}
      </svg>
    </div>
  );
}
