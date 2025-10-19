// client/src/components/WorkflowToApp.tsx
'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';

function clamp(n: number, a = 0, b = 1) { return Math.max(a, Math.min(b, n)); }

export default function WorkflowToApp() {
  const secRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0); // 0 → 1 progress

  useLayoutEffect(() => {
    const el = secRef.current;
    if (!el) return;

    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // start anim a bit after section top enters; finish before leaving
      const start = vh * 0.15;
      const end = vh * 1.4;
      const raw = (start - r.top) / end;
      setP(clamp(raw));
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // wire path between cards (morph as p changes)
  const pathD = (() => {
    // base positions that roughly match the card boxes below
    const W = 1200;
    const H = 700;

    // Workflow card center right edge
    const ax = 420 + 300; // cardX + cardWidth
    const ay = 260;

    // App card center left edge (slides in from right as p grows)
    const appX0 = 760;   // fully visible x
    const appHiddenOffset = 140;
    const bx = appX0 + (1 - p) * appHiddenOffset;
    const by = 290;

    const dx = Math.abs(bx - ax);
    const c = Math.max(100, dx * (0.35 + 0.25 * (1 - p)));

    return `M ${ax},${ay} C ${ax + c},${ay - 20} ${bx - c},${by + 20} ${bx},${by}`;
  })();

  return (
    <section
      ref={secRef}
      className="relative nocturne-band py-24"
      style={{ height: '210vh' }}
    >
      <div className="sticky top-0 h-[100vh] overflow-hidden">
        <div className="mx-auto max-w-6xl h-full relative px-6">
          {/* Headline */}
          <div className="pt-16 pb-6">
            <p className="text-xs tracking-[0.28em] uppercase text-white/60">From Workflow</p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">
              to <span className="text-rose-300/90">App Mode</span>
            </h2>
          </div>

          {/* Canvas */}
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md h-[70vh] shadow-[0_30px_80px_rgba(0,0,0,.65)] overflow-hidden">
            {/* Wire */}
            <svg
              className="absolute inset-0"
              viewBox="0 0 1200 700"
              preserveAspectRatio="none"
              style={{ pointerEvents: 'none' }}
            >
              <defs>
                <filter id="wfShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.28" />
                </filter>
              </defs>
              <path
                d={pathD}
                stroke="#cbd5e1"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'url(#wfShadow)' }}
              />
            </svg>

            {/* Workflow card (left) */}
            <div
              className="absolute"
              style={{
                left: 120 - p * 40,
                top: 140 - p * 12,
                width: 300 - p * 10,
                height: 240 - p * 6,
                transform: `scale(${1 - p * 0.06})`,
                transition: 'transform 0.06s linear',
              }}
            >
              <div className="rounded-xl border border-white/12 bg-white/[0.06] backdrop-blur-md h-full shadow-[0_20px_60px_rgba(0,0,0,.45)] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/70 mb-3">Workflow</div>

                {/* Steps */}
                <div className="grid gap-3">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="rounded-lg border border-white/12 bg-white/[0.04] p-3">
                      <div className="text-xs text-white/80 mb-2">Step {s}</div>
                      <div className="rounded-md border-2 border-dashed border-white/15 bg-white/5 h-16 grid place-items-center text-[11px] text-white/60">
                        drop image / video
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* App Mode (right) */}
            <div
              className="absolute"
              style={{
                left: 760 + (1 - p) * 140,
                top: 120 + (1 - p) * 20,
                width: 360 + p * 40,
                height: 300 + p * 40,
                opacity: 0.2 + p * 0.8,
                transform: `scale(${0.92 + p * 0.12})`,
                transition: 'transform 0.06s linear, opacity 0.06s linear',
              }}
            >
              <div className="relative rounded-xl border border-white/12 bg-white/[0.07] backdrop-blur-md h-full shadow-[0_30px_80px_rgba(0,0,0,.55)]">
                {/* subtle glow */}
                <div
                  className="absolute -inset-12"
                  style={{
                    background: 'radial-gradient(26rem 18rem at 50% 40%, rgba(236,72,153,.12), transparent 60%)',
                    filter: 'blur(8px)',
                    opacity: 0.6 * p,
                    pointerEvents: 'none',
                  }}
                />
                <div className="relative p-4 h-full">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/70 mb-3">App Mode</div>

                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="rounded-md border-2 border-dashed border-white/15 bg-white/5 aspect-[1/1] grid place-items-center text-[11px] text-white/60"
                      >
                        slot
                      </div>
                    ))}
                  </div>

                  {/* Bottom strip */}
                  <div className="absolute left-0 right-0 bottom-0 p-4">
                    <div className="h-10 rounded-lg border border-white/12 bg-white/[0.05]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Caption */}
            <div className="absolute left-0 right-0 bottom-4 flex items-center justify-center gap-2 text-white/70 text-xs">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400/80" />
              <span>Scroll to morph workflow into a shippable app canvas</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
