// client/src/components/ExploreWheel.tsx
'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Template = { id: string; title: string };

const ITEMS: Template[] = [
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
const DRIFT_PX_PER_S = 18;   // idle glide, leftwards
const HOLD_PX_PER_S  = 240;  // press-and-hold speed

export default function ExploreWheel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const loopWidth = useRef(0);
  const recentering = useRef(false);
  /** +1 => move content LEFT (increase scrollLeft), -1 => move RIGHT */
  const holdDir = useRef<0 | -1 | 1>(0);

  const tripled = [...ITEMS, ...ITEMS, ...ITEMS];

  // Measure on mount & on resize; start centered in the middle copy
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const measure = () => {
      // total scrollable width of the whole tripled strip
      const total = el.scrollWidth;
      const w = total / 3;
      loopWidth.current = w;
      // sit in the middle band to give headroom both sides
      el.scrollLeft = w;
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recenter only when leaving the safe middle third
  const recenterIfNeeded = () => {
    const el = scrollerRef.current;
    const w = loopWidth.current;
    if (!el || !w || recentering.current) return;

    const left = el.scrollLeft;
    // stay inside [0.5w, 1.5w] to avoid frequent snaps
    if (left < 0.5 * w || left > 1.5 * w) {
      recentering.current = true;
      el.scrollLeft = left < 0.5 * w ? left + w : left - w;
      // unlock next frame
      requestAnimationFrame(() => (recentering.current = false));
    }
  };

  /** Block wheel/trackpad/touch scroll inside the wheel (buttons control it) */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const prevent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Non-passive so preventDefault actually works.
    el.addEventListener('wheel', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });

    // Keep page scroll from “grabbing” when at edges
    (el.style as any).overscrollBehaviorX = 'contain';

    return () => {
      el.removeEventListener('wheel', prevent as any);
      el.removeEventListener('touchmove', prevent as any);
    };
  }, []);

  /** Idle drift + press-and-hold controls (requestAnimationFrame loop) */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let tPrev = performance.now();
    let raf = 0;

    const tick = () => {
      const now = performance.now();
      const dt = (now - tPrev) / 1000;
      tPrev = now;

      const vx =
        holdDir.current !== 0
          ? HOLD_PX_PER_S * holdDir.current
          : DRIFT_PX_PER_S; // idle drift is positive → content goes left

      // programmatic scroll (no smooth behavior to keep it crisp)
      el.scrollLeft += vx * dt;
      recenterIfNeeded();

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="relative overflow-hidden bg-[oklch(0.07_0_0)] text-white py-24">
      {/* Heading */}
      <div className="container mx-auto px-4 relative">
        <p className="tracking-[0.28em] uppercase text-sm/6 text-white/50">
          Explore our templates
        </p>
        <h2 className="mt-2 text-5xl md:text-6xl font-semibold">
          Pick a starting point — <span className="text-white/70">wheel it.</span>
        </h2>

        {/* Premium hold buttons — top-right */}
        <div className="absolute right-4 top-0 mt-4 md:right-8 md:mt-6 flex gap-3">
          <HoldButton
            ariaLabel="Hold to move left"
            onDown={() => (holdDir.current = +1)} // left button => move left
            onUp={() => (holdDir.current = 0)}
          >
            <ChevronLeft className="h-4 w-4" />
          </HoldButton>
          <HoldButton
            ariaLabel="Hold to move right"
            onDown={() => (holdDir.current = -1)} // right button => move right
            onUp={() => (holdDir.current = 0)}
          >
            <ChevronRight className="h-4 w-4" />
          </HoldButton>
        </div>
      </div>

      {/* Wheel */}
      <div className="relative mt-12">
        <div
          ref={scrollerRef}
          className="
            wheel flex gap-8 px-[8vw]
            overflow-x-auto overflow-y-hidden select-none
            cursor-default
          "
          // Fallback block for React synthetic wheel (in case the native listener misses)
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onScroll={recenterIfNeeded}
          onMouseDown={(e) => e.preventDefault()}  // avoid text selections while holding
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tripled.map((t, i) => (
            <Card key={`${t.id}-${i}`} title={t.title} />
          ))}
        </div>
      </div>

      {/* Hide webkit scrollbar just for this scroller */}
      <style>{`.wheel::-webkit-scrollbar{display:none;}`}</style>

      {/* subtle shine/vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)',
          background:
            'radial-gradient(1200px 240px at 50% -80px, rgba(255,255,255,.12), transparent 60%)',
          opacity: 0.7,
        }}
      />
    </section>
  );
}

/* ========== bits ========== */

function Card({ title }: { title: string }) {
  return (
    <article
      className="
        group relative rounded-2xl border border-white/10
        bg-white/[.03] shadow-[0_10px_40px_rgba(0,0,0,.45)]
        backdrop-blur-md min-w-[clamp(320px,36vw,760px)]
        hover:shadow-[0_14px_50px_rgba(0,0,0,.55)] transition-shadow
      "
      style={{ aspectRatio: '21 / 9' }}
      aria-label={title}
    >
      <div className="absolute inset-5 rounded-xl border border-dashed border-white/20 grid place-items-center text-white/60 text-lg">
        drop image / video
      </div>

      <div className="absolute left-5 right-5 bottom-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/70">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
          <span className="text-sm">ready to customize</span>
        </div>
        <button
          type="button"
          className="px-5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-white/90 transition-colors"
        >
          Use
        </button>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" />
    </article>
  );
}

function HoldButton({
  ariaLabel,
  onDown,
  onUp,
  children,
}: {
  ariaLabel: string;
  onDown: () => void;
  onUp: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="
        relative h-9 w-9 rounded-full
        bg-gradient-to-b from-white/12 to-white/[.06]
        ring-1 ring-white/18 hover:ring-white/28
        shadow-[0_8px_24px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.22)]
        text-white/90 grid place-items-center
        backdrop-blur-md transition
        active:scale-[0.97]
      "
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onDown();
      }}
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
          background:
            'linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 45%)',
          mixBlendMode: 'screen',
          opacity: 0.9,
        }}
      />
    </button>
  );
}
