// client/src/components/ExploreWheel.tsx
'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

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

/* ===== Motion knobs ===== */
const DRIFT_PX_PER_S = 12;   // idle auto-drift speed (left)
const IDLE_MS = 1400;        // how long after input to resume drifting
const HOLD_PX_PER_S = 220;   // press-and-hold speed (medium)

export default function ExploreWheel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const loopWidth = useRef(0);
  const recentering = useRef(false);

  // input state
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ active: boolean; startX: number; startLeft: number }>({
    active: false,
    startX: 0,
    startLeft: 0,
  });
  const lastInputAt = useRef(performance.now());
  const holdDir = useRef<0 | -1 | 1>(0); // -1 = left, +1 = right
  const raf = useRef<number | null>(null);

  // tripled list for seamless loop
  const tripled = [...ITEMS, ...ITEMS, ...ITEMS];

  /* ---------- layout & initial center ---------- */
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const setInitial = () => {
      const w = el.scrollWidth / 3; // one logical loop width
      loopWidth.current = w;
      el.scrollLeft = w; // start on the middle copy
    };

    setInitial();
    const ro = new ResizeObserver(setInitial);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- keep scroll centered in middle third ---------- */
  const recenterIfNeeded = () => {
    const el = trackRef.current;
    const w = loopWidth.current;
    if (!el || !w || recentering.current) return;

    const left = el.scrollLeft;
    const min = 0.5 * w;
    const max = 1.5 * w;

    if (left < min || left > max) {
      recentering.current = true;
      el.scrollLeft = left < min ? left + w : left - w;
      requestAnimationFrame(() => (recentering.current = false));
    }
  };

  /* ---------- wheel: turn vertical deltas into horizontal ---------- */
  const onWheel = (e: React.WheelEvent) => {
    const el = trackRef.current;
    if (!el) return;
    lastInputAt.current = performance.now();

    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    e.preventDefault();
    el.scrollLeft += dx;
    recenterIfNeeded();
  };

  /* ---------- pointer drag for precise control ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft };
    setDragging(true);
    lastInputAt.current = performance.now();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.active) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - dragState.current.startX;
    el.scrollLeft = dragState.current.startLeft - dx;
    recenterIfNeeded();
  };
  const endDrag = () => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    setDragging(false);
    lastInputAt.current = performance.now();
  };

  /* ---------- idle drift + hold-to-scroll ---------- */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let prev = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - prev) / 1000;
      prev = now;

      // hold takes priority
      if (holdDir.current !== 0) {
        el.scrollLeft += HOLD_PX_PER_S * holdDir.current * dt;
        recenterIfNeeded();
      } else {
        // otherwise drift gently when idle & not dragging
        const idle = now - lastInputAt.current > IDLE_MS && !dragging;
        if (idle) {
          el.scrollLeft += DRIFT_PX_PER_S * dt; // to the left
          recenterIfNeeded();
        }
      }

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [dragging]);

  /* ---------- press-and-hold buttons ---------- */
  const startHold = (dir: -1 | 1) => {
    holdDir.current = dir;
    lastInputAt.current = performance.now();
  };
  const stopHold = () => {
    holdDir.current = 0;
    lastInputAt.current = performance.now();
  };

  return (
    <section className="relative overflow-hidden bg-[oklch(0.07_0_0)] text-white py-24">
      {/* edge mask/vignette */}
      <div
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

      {/* header row */}
      <div className="container mx-auto px-4 relative">
        <p className="tracking-[0.28em] uppercase text-sm/6 text-white/50">
          Explore our templates
        </p>
        <h2 className="mt-2 text-5xl md:text-6xl font-semibold">
          Pick a starting point — <span className="text-white/70">wheel it.</span>
        </h2>

        {/* press-and-hold controls — top-right, like your marks */}
        <div className="absolute right-4 top-0 mt-4 md:right-8 md:mt-6 flex gap-3">
          <HoldButton
            ariaLabel="Hold to move left"
            onDown={() => startHold(-1)}
            onUp={stopHold}
          />
          <HoldButton
            ariaLabel="Hold to move right"
            onDown={() => startHold(1)}
            onUp={stopHold}
          />
        </div>
      </div>

      {/* the wheel */}
      <div className="relative mt-12">
        <div
          ref={trackRef}
          className="
            wheel flex gap-8 px-[8vw]
            overflow-x-auto overflow-y-hidden
            select-none cursor-grab active:cursor-grabbing
          "
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tripled.map((t, i) => (
            <Card key={`${t.id}-${i}`} title={t.title} />
          ))}
        </div>
      </div>

      {/* hide webkit scrollbar just for this track */}
      <style>{`.wheel::-webkit-scrollbar{display:none;}`}</style>
    </section>
  );
}

/* ---------- UI bits ---------- */

function Card({ title }: { title: string }) {
  return (
    <article
      className="
        group relative rounded-2xl border border-white/10
        bg-white/[.03] shadow-[0_10px_40px_rgba(0,0,0,.45)]
        backdrop-blur-md min-w-[clamp(320px,36vw,760px)]
      "
      style={{ aspectRatio: '21 / 9' }} // cinematic
      aria-label={title}
    >
      <div className="absolute inset-0 rounded-2xl ring-1 ring-white/5" />
      <div className="absolute inset-px rounded-2xl bg-[oklch(0.18_0_0/.5)]" />

      <div
        className="
          absolute inset-5 rounded-xl border border-dashed border-white/20
          grid place-items-center text-white/60 text-lg
        "
        style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.02))' }}
      >
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

      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.06)]" />
    </article>
  );
}

function HoldButton({
  ariaLabel,
  onDown,
  onUp,
}: {
  ariaLabel: string;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="
        relative h-8 w-8 rounded-full
        bg-[oklch(0.65_0.24_30)] shadow-[0_6px_20px_rgba(255,80,90,.35)]
        ring-1 ring-white/10 hover:brightness-110 active:scale-[0.96]
        transition will-change-transform
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
      {/* subtle inner dot */}
      <span className="pointer-events-none absolute inset-0 m-auto h-2 w-2 rounded-full bg-white/80 opacity-70" />
    </button>
  );
}
