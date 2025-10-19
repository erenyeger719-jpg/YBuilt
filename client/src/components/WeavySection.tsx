'use client';

import React, { PropsWithChildren, useMemo } from 'react';
import PixelSpill from '@/components/PixelSpill';

type Props = PropsWithChildren<{
  bandHeightRem?: number;
  /** optional palette to echo hero tone */
  colors?: string[];
  /** how chunky the crown is (0.7–1.0) */
  density?: number;
  /** number of rows to fade before nodes (in grid rows) */
  fadeRows?: number;
  /** grid cell size (px): 16px gap + 1px line = 17 */
  cellPx?: number;
}>;

export default function WeavySection({
  children,
  bandHeightRem = 14,
  colors,
  density = 0.95,
  fadeRows = 6,
  cellPx = 17,
}: Props) {
  // keep everything in physical pixels so it “locks” to the one-space grid
  const bandPx = useMemo(() => Math.round(bandHeightRem * 16), [bandHeightRem]);

  // default graphite palette (hero spill vibe)
  const palette =
    colors ??
    ['#0b0c10', '#14161a', '#1f2329', '#2b3037', '#363c44', '#4a515a']; // very subtle lift

  return (
    <section className="weavy-section">
      <div className="weavy-canvas" style={{ position: 'relative', minHeight: bandPx + 1 }}>
        {/* grid band lives under everything */}
        <div className="grid-band" style={{ top: 0, height: bandPx }} />

        {/* pixel spill sits on top of the band, below content */}
        <PixelSpill
          top={0}
          height={bandPx}
          cell={cellPx}
          fadeRows={fadeRows}
          density={density}
          colors={palette}
        />

        {/* node content starts after the bridge band */}
        <div style={{ position: 'relative', zIndex: 2, paddingTop: bandPx }}>{children}</div>
      </div>
    </section>
  );
}
