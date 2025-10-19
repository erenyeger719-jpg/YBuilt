'use client';

import React from 'react';

type Piece = {
  className: string;
  left: string; top: string; width: string; height: string;
  rotate?: number;
  z?: number;
};

const pieces: Piece[] = [
  { className: 'geom geom--rect  geom--cardboard geom-citron geom--stroke', left: '6%',  top: '12%', width: '220px', height: '120px', rotate: -3 },
  { className: 'geom geom--pill  geom--origami  geom-cobalt  geom--stroke',  left: '22%', top: '18%', width: '320px', height: '80px',  rotate: 8  },
  { className: 'geom geom--triangle geom--cardboard geom-verm geom--stroke', left: '40%', top: '8%',  width: '180px', height: '160px', rotate: 0  },
  { className: 'geom geom--circle geom--origami geom-fuch geom--stroke',     left: '55%', top: '22%', width: '140px', height: '140px' },
  { className: 'geom geom--rect  geom--cardboard geom-ivory  geom--stroke',   left: '64%', top: '10%', width: '260px', height: '120px', rotate: -6 },
  { className: 'geom geom--pill  geom--origami  geom-cobalt  geom--stroke',   left: '78%', top: '20%', width: '280px', height: '72px',  rotate: 12 },
  { className: 'geom geom--rect  geom--cardboard geom-ink    geom--stroke',   left: '12%', top: '32%', width: '160px', height: '90px',  rotate: -8, z: -1 },
  { className: 'geom geom--triangle geom--origami geom-citron geom--stroke',  left: '30%', top: '34%', width: '160px', height: '140px', rotate: 3,  z: -1 },
];

export default function GeometryBackdrop({ topOffset = 0, heightRem = 28 }: { topOffset?: number; heightRem?: number }) {
  return (
    <div
      className="gallery-ground"
      style={{
        position: 'absolute',
        inset: 0,
        top: topOffset,                 // start right under the spill
        height: `${heightRem}rem`,
        zIndex: 1                       // under the node content (which is z=2)
      }}
      aria-hidden
    >
      {pieces.map((p, i) => (
        <div
          key={i}
          className={p.className}
          style={{
            left: p.left, top: p.top, width: p.width, height: p.height,
            transform: `rotate(${p.rotate ?? 0}deg)`,
            zIndex: p.z ?? 1
          }}
        />
      ))}
    </div>
  );
}
