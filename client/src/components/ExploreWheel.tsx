// client/src/components/ExploreWheel.tsx
'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type T = { id: string; title: string };

const ITEMS: T[] = [
  { id: 't1', title: 'Template 1' },
  { id: 't2', title: 'Template 2' },
  { id: 't3', title: 'Template 3' },
  { id: 't4', title: 'Template 4' },
  { id: 't5', title: 'Template 5' },
  { id: 't6', title: 'Template 6' },
  { id: 't7', title: 'Template 7' },
  { id: 't8', title: 'Template 8' },
];

/** Tunables */
const DRIFT_PX_PER_S = 24;     // idle glide (left) — 1.5× faster
const HOLD_PX_PER_S  = 220;    // press-and-hold add/sub speed
const SAFE_MIN = 0.4;          // recenter window (as fraction of loop width)
const SAFE_MAX = 1.6;

export default function ExploreWheel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const loopW = useRef(0);
  const holdDir = useRef<-1 | 0 | 1>(0);  // +1 = move left, -1 = right
  const residual = useRef(0);             // fractional px accumulator

  const tripled = [...ITEMS, ...ITEMS, ...ITEMS];

  // Measure & center to middle band
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const measure = () => {
      const total = el.scrollWidth;
      loopW.current = total / 3;
      el.scrollLeft = loopW.current; // start in the middle copy
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep scroll within middle third (no jitter)
  const recenterIfNeeded = () => {
    const el = scrollerRef.current;
    const w = loopW.current;
    if (!el || !w) return;

    const x = el.scrollLeft;
    if (x < SAFE_MIN * w) el.scrollLeft = x + w;
    else if (x > SAFE_MAX * w) el.scrollLeft = x - w;
  };

  // Block mouse-wheel/trackpad/touch inside the wheel
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const prevent = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    el.addEventListener('wheel', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    (el.style as any).overscrollBehaviorX = 'contain';

    return () => {
      el.removeEventListener('wheel', prevent as any);
      el.removeEventListener('touchmove', prevent as any);
    };
  }, []);

  // Idle drift + hold buttons (rAF). Uses fractional accumulation so tiny speeds still move.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let tPrev = performance.now();
    let raf = 0;

    const tick = () => {
      const now = performance.now();
      const dt = (now - tPrev) / 1000;
      tPrev = now;

      // base left drift, add/sub with hold
      const v = DRIFT_PX_PER_S + holdDir.current * HOLD_PX_PER_S; // px/s (positive -> move content left)
      const delta = v * dt + residual.current;

      // scrollLeft is effectively integer on some browsers; carry the fraction
      const step = (delta > 0) ? Math.floor(delta) : Math.ceil(delta);
      residual.current = delta - step;

      if (step !== 0) {
        el.scrollLeft += step;
        recenterIfNeeded();
      }

      raf = requestAnimationFrame(tick);
    };

    // pause when tab hidden
    const onVis = () => { tPrev = performance.now(); };
    document.addEventListener('visibilitychange', onVis);

    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <section className="relative overflow-hidden atelier-band py-24">
      {/* cut-paper layers (decor) */}
      <div
        aria-hidden
        className="paper-block paper-ivory block-torn-1"
        style={{ left: '-6vw', top: '4rem', width: '44vw', height: '18rem', transform: 'rotate(-3deg)' }}
      />
      <div
        aria-hidden
        className="paper-block paper-cobalt block-torn-2"
        style={{ right: '-8vw', top: '10rem', width: '36vw', height: '14rem', transform: 'rotate(5deg)' }}
      />
      <div
        aria-hidden
        className="paper-block paper-verm block-torn-3"
        style={{ left: '12vw', bottom: '-5rem', width: '28vw', height: '12rem', transform: 'rotate(-6deg)' }}
      />

      <div className="container mx-auto px-4 relative">
        <p className="tracking-[0.28em] uppercase text-sm/6 text-white/70">Explore our templates</p>
        <h2 className="mt-2 text-5xl md:text-6xl font-semibold riso-register">
          Pick a starting point — <span className="text-white">wheel it.</span>
        </h2>

        {/* Premium hold buttons — top-right */}
        <div className="absolute right-4 top-0 mt-4 md:right-8 md:mt-6 flex gap-3">
          <HoldButton
            ariaLabel="Hold to move left"
            onDown={() => (holdDir.current = +1)}   // left btn => move content left
            onUp={() => (holdDir.current = 0)}
          >
            <ChevronLeft className="h-4 w-4" />
          </HoldButton>
          <HoldButton
            ariaLabel="Hold to move right"
            onDown={() => (holdDir.current = -1)}   // right btn => move content right
            onUp={() => (holdDir.current = 0)}
          >
            <ChevronRight className="h-4 w-4" />
          </HoldButton>
        </div>
      </div>

      {/* Wheel strip */}
      <div className="relative mt-12">
        <div
          ref={scrollerRef}
          className="wheel flex gap-8 px-[8vw] overflow-x-auto overflow-y-hidden select-none cursor-default"
          onWheel={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onScroll={recenterIfNeeded}
          onMouseDown={(e) => {
            const t = e.target as HTMLElement | null;
            // allow clicks on interactive controls inside the wheel
            if (t && t.closest('a,button,[role="button"],input,textarea,select,label')) return;
            e.preventDefault();
          }}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'auto' }}
        >
          {tripled.map((t, i) => (<Card key={`${t.id}-${i}`} title={t.title} />))}
        </div>
      </div>

      {/* Hide webkit scrollbar for this scroller only */}
      <style>{`.wheel::-webkit-scrollbar{display:none;}`}</style>
    </section>
  );
}

/* ——— bits ——— */

function Card({ title }: { title: string }) {
  return (
    <article
      className="group relative sketch-edge rounded-2xl border border-white/10 bg-white/[.03] shadow-[0_10px_40px_rgba(0,0,0,.45)] backdrop-blur-md min-w-[clamp(320px,36vw,760px)] hover:shadow-[0_14px_50px_rgba(0,0,0,.55)] transition-shadow"
      style={{ aspectRatio: '21 / 9' }}
      aria-label={title}
    >
      <div className="absolute inset-5 rounded-xl border border-dashed border-white/20 grid place-items-center text-white/60 text-lg sketch-hatch">
        drop image / video
      </div>
      <div className="absolute left-5 right-5 bottom-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/70">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
          <span className="text-sm">ready to customize</span>
        </div>
        <a
          href="/templates"
          onMouseDown={(e) => e.stopPropagation()}
          className="px-5 py-2 rounded-lg border border-white/15 text-white/90
                     bg-white/5 hover:bg-white/10 focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] transition-colors"
        >
          Use
        </a>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" />
    </article>
  );
}

function HoldButton({
  ariaLabel, onDown, onUp, children,
}: { ariaLabel: string; onDown: () => void; onUp: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={ariaLabel}
      className="relative h-9 w-9 rounded-full bg-gradient-to-b from-white/12 to-white/[.06] ring-1 ring-white/18 hover:ring-white/28 shadow-[0_8px_24px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.22)] text-white/90 grid place-items-center backdrop-blur-md transition active:scale-[0.97]"
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); onDown(); }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="pointer-events-none">{children}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 45%)',
          mixBlendMode: 'screen',
          opacity: 0.9,
        }}
      />
    </button>
  );
}
