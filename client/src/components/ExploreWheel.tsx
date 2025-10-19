'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Item = {
  id: string;
  title: string;
  subtitle?: string;
};

const ITEMS: Item[] = [
  { id: 't1', title: 'Template Slot 1' },
  { id: 't2', title: 'Template Slot 2' },
  { id: 't3', title: 'Template Slot 3' },
  { id: 't4', title: 'Template Slot 4' },
  { id: 't5', title: 'Template Slot 5' },
  { id: 't6', title: 'Template Slot 6' },
  { id: 't7', title: 'Template Slot 7' },
  { id: 't8', title: 'Template Slot 8' },
];

export default function ExploreWheel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeId, setActiveId] = useState(ITEMS[0]?.id);

  // vertical wheel -> horizontal scroll; also keyboard
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Use vertical wheel to scroll X, prevent accidental page scroll
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.05;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (!wrapRef.current) return;
      const isInside =
        document.activeElement === document.body ||
        wrapRef.current.contains(document.activeElement);
      if (!isInside) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const idx = ITEMS.findIndex(i => i.id === activeId);
        const next =
          e.key === 'ArrowRight'
            ? Math.min(idx + 1, ITEMS.length - 1)
            : Math.max(idx - 1, 0);
        const ref = cardRefs.current.get(ITEMS[next].id);
        ref?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('wheel', onWheel as any);
      window.removeEventListener('keydown', onKey);
    };
  }, [activeId]);

  // drag-to-scroll with gentle snap
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let dragging = false;
    let startX = 0;
    let startLeft = 0;
    let v = 0; // velocity
    let lastX = 0;
    let raf: number | null = null;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      lastX = e.clientX;
      (el as HTMLElement).setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      el.scrollLeft = startLeft - dx;
      v = e.clientX - lastX;
      lastX = e.clientX;
      scheduleSync();
    };
    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      // inertial flick
      const target = el.scrollLeft - v * 4;
      smoothTo(el, target, 260, () => snapToNearest());
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    const snapToNearest = () => {
      const cards = [...cardRefs.current.values()];
      const cx = el.clientWidth / 2;
      let best: HTMLElement | null = null;
      let bestDist = Infinity;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        const mid = r.left - el.getBoundingClientRect().left + r.width / 2;
        const d = Math.abs(mid - cx);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      best?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
    };

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      if (raf) cancelAnimationFrame(raf);
    };

    function smoothTo(el: HTMLElement, x: number, ms: number, end?: () => void) {
      const start = el.scrollLeft;
      const t0 = performance.now();
      const ease = (p: number) => 1 - Math.pow(1 - p, 3);

      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / ms);
        el.scrollLeft = start + (x - start) * ease(p);
        scheduleSync();
        if (p < 1) raf = requestAnimationFrame(tick);
        else end?.();
      };
      raf = requestAnimationFrame(tick);
    }

    function scheduleSync() {
      if (raf) return; // tick will sync
      raf = requestAnimationFrame(() => {
        raf = null;
        syncTransforms();
      });
    }
  }, []);

  // transform cards based on distance to center (arc + scale + subtle tilt)
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onScroll = () => syncTransforms();
    const onResize = () => syncTransforms();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    syncTransforms();
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const syncTransforms = () => {
    const el = trackRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;

    let bestId = activeId;
    let bestDist = Infinity;

    for (const item of ITEMS) {
      const card = cardRefs.current.get(item.id);
      if (!card) continue;
      const rect = card.getBoundingClientRect();
      const mid = rect.left - el.getBoundingClientRect().left + rect.width / 2;
      const raw = Math.abs(mid - cx); // px distance from center
      const w = el.clientWidth / 2;    // half viewport
      const d = Math.min(1, raw / w);  // 0 (center) → 1 (edge)

      // scale and vertical arc lift
      const scale = 1 + (1 - d) * 0.28;
      const lift = (1 - Math.pow(d, 2)) * 48; // center lifts up more
      const tilt = (1 - d) * 8;               // subtle tilt near center

      card.style.transform = `translateY(${-lift}px) scale(${scale}) rotateX(${tilt}deg)`;
      card.style.opacity = String(0.55 + (1 - d) * 0.45);
      (card.firstElementChild as HTMLElement).style.filter = `saturate(${0.9 + (1 - d) * 0.4})`;

      if (raw < bestDist) {
        bestDist = raw;
        bestId = item.id;
      }
    }
    if (bestId !== activeId) setActiveId(bestId);
  };

  return (
    <section
      ref={wrapRef}
      className="relative py-24 md:py-32"
      style={{
        background:
          'radial-gradient(60rem 32rem at 20% -10%, hsla(329,64%,70%,.15), transparent 60%), radial-gradient(50rem 30rem at 110% 10%, hsla(210,60%,60%,.12), transparent 60%), linear-gradient(180deg, #070709, #0b0c10)',
        color: 'white',
      }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-end justify-between gap-6 mb-10 md:mb-14">
          <div>
            <p className="text-xs tracking-[0.28em] uppercase/relaxed text-white/60">Explore our templates</p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mt-2">
              Pick a starting point<span className="text-white/50"> — wheel it.</span>
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-white/70">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-400/80" />
            <span>{ITEMS.findIndex(i => i.id === activeId) + 1} / {ITEMS.length}</span>
          </div>
        </div>
      </div>

      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0b0c10] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0b0c10] to-transparent" />

      <div className="mx-auto max-w-7xl px-2 md:px-6">
        <div
          ref={trackRef}
          className="relative flex gap-10 md:gap-14 overflow-x-auto scroll-smooth snap-x snap-mandatory px-6 md:px-10 py-2"
          style={{
            perspective: '1200px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {ITEMS.map((item) => (
            <div
              key={item.id}
              ref={(el) => el && cardRefs.current.set(item.id, el)}
              className="snap-center shrink-0 will-change-transform transition-[opacity,filter] duration-150"
              style={{ width: 340, maxWidth: '70vw' }}
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,.5)]">
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/70">{item.title}</div>
                  <div className="flex gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                  </div>
                </div>

                {/* Media well (leave blank for assets later) */}
                <div className="mx-4 mb-4 rounded-xl border-2 border-dashed border-white/15 bg-white/5 aspect-[16/10] grid place-items-center text-white/60 text-xs">
                  drop image / video
                </div>

                {/* Meta */}
                <div className="px-4 pb-4 flex items-center justify-between text-white/70 text-xs">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-400/80" />
                    ready to customize
                  </span>
                  <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 border border-white/15">
                    Use
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
