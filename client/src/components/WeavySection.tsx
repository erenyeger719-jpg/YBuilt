'use client';

import React, { useEffect, useState } from 'react';
import PixelSpill from '@/components/PixelSpill';

type Props = {
  children: React.ReactNode;
  bandHeightRem?: number; // how tall the grid band is (visual bridge)
  gapPx?: number;         // grid gap inside the band (CSS --gap)
  linePx?: number;        // grid line thickness
  colors?: string[];      // optional palette for the spill
  density?: number;       // 0..1 fill amount
  fadeRows?: number;      // rows that fade to 0 just before nodes
  seed?: number;          // deterministic layout
};

export default function WeavySection({
  children,
  bandHeightRem = 14,
  gapPx = 14,         // << matches .weavy-section .grid-band in your CSS
  linePx = 1,
  colors,
  density = 0.95,
  fadeRows = 6,
  seed = 20251019,
}: Props) {
  const [heightPx, setHeightPx] = useState(() => Math.round(bandHeightRem * 16));

  useEffect(() => {
    // Convert rem → px from actual root font size so it matches your site
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    setHeightPx(Math.round(bandHeightRem * fs));
  }, [bandHeightRem]);

  const cell = gapPx + linePx; // keep tiles locked to the grid rhythm

  return (
    <section className="weavy-section" style={{ paddingTop: `${bandHeightRem}rem` }}>
      <div className="weavy-canvas">
        {/* full-width grid band behind content */}
        <div className="grid-band" style={{ top: 0, height: `${bandHeightRem}rem` }} />

        {/* pixel spill over the band, fading before nodes */}
        <PixelSpill
          top={0}
          height={heightPx}
          cell={cell}
          fadeRows={fadeRows}
          density={density}
          seed={seed}
          colors={colors}
        />

        {/* your nodes/content */}
        <div className="relative z-[2]">
          {children}
        </div>
      </div>
    </section>
  );
}
