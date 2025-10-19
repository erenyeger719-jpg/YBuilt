// client/src/components/WeavySection.tsx
'use client';

import React, { PropsWithChildren, useMemo } from 'react';
import PixelSpill from '@/components/PixelSpill';
import GeometryBackdrop from '@/components/GeometryBackdrop';

type Props = PropsWithChildren<{
  /** Height of the spill/crown band in rems (controls PixelSpill & node offset) */
  bandHeightRem?: number;
  /** optional palette to echo hero tone (kept for back-compat; unused by new spill) */
  colors?: string[];
  /** how chunky the crown is (0.7–1.0) */
  density?: number;
  /** number of rows to fade before nodes (in grid rows) */
  fadeRows?: number;
  /** grid cell size (px) — 9px is “half-space” tiles */
  cellPx?: number;
  /** how far the background grid extends (separate from spill height) */
  gridDepthRem?: number;
  /** when the grid starts fading (percentage of its own height, e.g. '84%') */
  gridFadeStart?: string;
}>;

export default function WeavySection({
  children,
  bandHeightRem = 16,   // a touch taller to match the guide
  colors,               // kept for API compatibility
  density = 1.0,        // fuller crown / more spill
  fadeRows = 9,         // slower fade before nodes
  cellPx = 9,           // half-size tiles for tighter grain
  gridDepthRem = 34,    // extend grid further than the spill (updated default)
  gridFadeStart = '92%' // begin fade near the end (updated default)
}: Props) {
  // lock measurements to physical pixels for crisp alignment
  const bandPx = useMemo(() => Math.round(bandHeightRem * 16), [bandHeightRem]);
  const gridPx = useMemo(() => Math.round(gridDepthRem * 16), [gridDepthRem]); // reserved if needed later

  return (
    <section className="weavy-section">
      <div className="weavy-canvas" style={{ position: 'relative', minHeight: bandPx + 1 }}>
        {/* background grid: deeper than the spill; fade start is configurable */}
        <div
          className="grid-band"
          style={{
            top: 0,
            height: `${gridDepthRem}rem`,
            ['--grid-fade-start' as any]: gridFadeStart
          }}
        />

        {/* pixel spill sits on top of the band, below content */}
        <PixelSpill
          top={0}
          height={bandPx}   // px for crisp alignment
          cell={cellPx}
          solidRows={2}     // top two rows solid
          fadeRows={fadeRows}
          density={density}
          color="#000"
          seed={20251019}
        />

        {/* NEW: geometric paper backdrop under nodes */}
        <GeometryBackdrop topOffset={bandPx} heightRem={30} />

        {/* node content starts after the spill height */}
        <div style={{ position: 'relative', zIndex: 2, paddingTop: bandPx }}>
          {children}
        </div>
      </div>
    </section>
  );
}
