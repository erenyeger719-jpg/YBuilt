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

// how fast the idle auto-drift moves (px / second)
const DRIFT_PX_PER_S = 12;
// how long after any user input before drift resumes
const IDLE_MS = 1500;

export default function ExploreWheel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // user interaction state
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ active: boolean; startX: number; startLeft: number }>({
    active: false,
    startX: 0,
    startLeft: 0,
  });

  const lastInputAt = useRef<number>(performance.now());
  const rafId = useRef<number | null>(null);
  const loopWidth = useRef<number>(0);
  const recentering = useRef(false);

  // duplicate list 3× to allow infinite scroll + recentering
  const tripled = [...ITEMS, ...ITEMS, ...ITEMS];

  // on mount/resize, set an initial center position (middle copy)
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const setInitial = () => {
      // width of one full logical list (first 1/3 of track scroll width)
      const w = el.scrollWidth / 3;
      loopWidth.current = w;
      // jump to the middle copy so we can scroll both ways
      el.scrollLeft = w;
    };

    setInitial();
    const ro = new ResizeObserver(setInitial);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // keep scroll position “in the middle third”
  const recenterIfNeeded = () => {
    const el = trackRef.current;
    const w = loopWidth.current;
    if (!el || !w) return;

    // guard to avoid feedback loops
    if (recentering.current) return;

    // we keep the user in [0.5w, 1.5w] around the middle copy
    const left = el.scrollLeft;
    const min = 0.5 * w;
    const max = 1.5 * w;

    if (left < min || left > max) {
      recentering.current = true;
      // preserve the visible offset by wrapping
      const newLeft = left < min ? left + w : left - w;
      el.scrollLeft = newLeft;
      // next frame we can accept events again
      requestAnimationFrame(() => (recentering.current = false));
    }
  };

  // convert vertical wheel → horizontal scroll (prevents the “laggy” feel)
  const onWheel = (e: React.WheelEvent) => {
    const el = trackRef.current;
    if (!el) return;

    // mark input so auto-drift pauses
    lastInputAt.current = performance.now();

    // allow native horizontal delta, convert vertical delta into horizontal
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    // stop the page from moving vertically while user interacts with the wheel
    e.preventDefault();
    el.scrollLeft += dx;

    recenterIfNeeded();
  };

  // pointer drag (mouse/touch) for precise, non-jitter control
  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging || setDragging(true);
    dragState.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft };
    lastInputAt.current = performance.now();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.active) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - dragState.current.startX;
    el.scrollLeft = dragState.current.startLeft - dx; // drag feels natural
    recenterIfNeeded();
  };
  const endDrag = () => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    setDragging(false);
    lastInputAt.current = performance.now();
  };

  // idle auto-drift
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let prev = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - prev) / 1000;
      prev = now;

      const idle = now - lastInputAt.current > IDLE_MS;
      if (idle && !dragging) {
        el.scrollLeft += DRIFT_PX_PER_S * dt;
        recenterIfNeeded();
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [dragging]);

  return (
    <section
      className="relative overflow-hidden bg-[oklch(0.07_0_0)] text-white py-24"
      aria-label="Explore our templates"
    >
      {/* edge vignette / mask to hide any hint of scrollbar and sell the “wheel” */}
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

      <div className="container mx-auto px-4">
        <p className="tracking-[0.28em] uppercase text-sm/6 text-white/50">
          Explore our templates
        </p>
        <h2 className="mt-2 text-5xl md:text-6xl font-semibold">
          Pick a starting point — <span className="text-white/70">wheel it.</span>
        </h2>
      </div>

      {/* the wheel */}
      <div
        ref={wrapRef}
        className="relative mt-12"
      >
        <div
          ref={trackRef}
          className="wheel flex gap-8 px-[8vw] overflow-x-auto overflow-y-hidden select-none cursor-grab active:cursor-grabbing"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          // hide scrollbar (Firefox/Edge) – webkit handled by <style> below
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tripled.map((t, i) => (
            <Card key={`${t.id}-${i}`} title={t.title} />
          ))}
        </div>
      </div>

      {/* hide webkit scrollbar just for this track */}
      <style>{`
        .wheel::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}

function Card({ title }: { title: string }) {
  return (
    <article
      className="
        group relative
        rounded-2xl border border-white/10
        bg-white/[.03] shadow-[0_10px_40px_rgba(0,0,0,.45)]
        backdrop-blur-md
        min-w-[clamp(320px,36vw,760px)]
        "
      style={{ aspectRatio: '21 / 9' }} // cinematic, no cropping
    >
      {/* inner frame */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-white/5" />
      <div className="absolute inset-px rounded-2xl bg-[oklch(0.18_0_0/.5)]" />

      {/* drop slot */}
      <div
        className="
          absolute inset-5 rounded-xl
          border border-dashed border-white/20
          grid place-items-center
          text-white/60 text-lg
        "
        style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.02))' }}
      >
        drop image / video
      </div>

      {/* footer */}
      <div className="absolute left-5 right-5 bottom-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/70">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
          <span className="text-sm">ready to customize</span>
        </div>
        <button
          className="
            px-5 py-2 rounded-lg
            bg-white/5 hover:bg-white/10
            border border-white/15
            text-white/90
            transition-colors
          "
          type="button"
        >
          Use
        </button>
      </div>

      {/* subtle tilt/parallax */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.06)]" />
    </article>
  );
}
