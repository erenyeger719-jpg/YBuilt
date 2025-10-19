// client/src/components/WeavySection.tsx
'use client';

import React, { PropsWithChildren, useMemo } from 'react';
import PixelSpill from '@/components/PixelSpill';

type Props = PropsWithChildren<{
  /** Height of the bridge band in rems */
  bandHeightRem?: number;
  /** optional palette to echo hero tone (kept for back-compat; unused by new spill) */
  colors?: string[];
  /** how chunky the crown is (0.7–1.0) */
  density?: number;
  /** number of rows to fade before nodes (in grid rows) */
  fadeRows?: number;
  /** grid cell size (px) — 9px is “half-space” tiles */
  cellPx?: number;
}>;

export default function WeavySection({
  children,
  bandHeightRem = 16, // a touch taller to match the guide
  colors,             // kept for API compatibility
  density = 1.0,      // fuller crown / more spill
  fadeRows = 9,       // slower fade before nodes
  cellPx = 9,         // half-size tiles for tighter grain
}: Props) {
  // keep everything in physical pixels so it “locks” to the one-space grid
  const bandPx = useMemo(() => Math.round(bandHeightRem * 16), [bandHeightRem]);

  return (
    <section className="weavy-section">
      <div className="weavy-canvas" style={{ position: 'relative', minHeight: bandPx + 1 }}>
        {/* grid band lives under everything */}
        <div
          className="grid-band"
          style={{ top: 0, height: `${bandHeightRem}rem` }}
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

        {/* node content starts after the bridge band */}
        <div style={{ position: 'relative', zIndex: 2, paddingTop: bandPx }}>
          {children}
        </div>
      </div>
    </section>
  );
}
