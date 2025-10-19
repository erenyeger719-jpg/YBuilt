// client/src/components/ExploreWheel.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";

type Template = { id: string; title: string };

const BASE: Template[] = Array.from({ length: 8 }, (_, i) => ({
  id: `t${i + 1}`,
  title: `Template ${i + 1}`,
}));

export default function ExploreWheel() {
  // We render 3 sets: [clones][real][clones] — then loop the scroll inside the middle band.
  const items = useMemo(() => [...BASE, ...BASE, ...BASE], []);
  const viewRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<HTMLDivElement[]>([]);
  const [active, setActive] = useState(0);

  // keep refs length in sync
  useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, items.length);
  }, [items.length]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;

    // center on the middle set on mount
    const setW = el.scrollWidth / 3;
    el.scrollLeft = setW + 1; // just inside the middle band

    // vertical mouse wheel → horizontal scroll
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    // loop + depth transform
    const onScroll = () => {
      const setW = el.scrollWidth / 3;

      // Seamless looping: if you drift too far left/right, jump by one set width
      if (el.scrollLeft < setW * 0.5) el.scrollLeft += setW;
      else if (el.scrollLeft > setW * 1.5) el.scrollLeft -= setW;

      // Per-card transform based on distance to center
      const center = el.scrollLeft + el.clientWidth / 2;
      let nearest = { idx: 0, dist: Number.POSITIVE_INFINITY };

      cardRefs.current.forEach((node, i) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const xCenter = rect.left + rect.width / 2 + el.scrollLeft; // in scroll coords
        const d = xCenter - center;
        const t = Math.min(1, Math.abs(d) / (el.clientWidth * 0.9)); // 0 near center → 1 far
        const scale = 1 - t * 0.18;
        const rotateY = (d / el.clientWidth) * -10; // degrees

        node.style.transform = `translateZ(0) rotateY(${rotateY}deg) scale(${scale})`;
        node.style.zIndex = String((scale * 1000) | 0);

        const dist = Math.abs(d);
        if (dist < nearest.dist) nearest = { idx: i % BASE.length, dist };
      });

      setActive(nearest.idx);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    requestAnimationFrame(onScroll); // run once to set initial transforms

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section className="relative overflow-visible bg-gradient-to-b from-black via-slate-950 to-black text-white py-24">
      {/* Heading */}
      <div className="max-w-6xl mx-auto px-6">
        <p className="uppercase tracking-[0.25em] text-sm/6 text-white/55">
          Explore our templates
        </p>
        <h2 className="h-display text-4xl sm:text-6xl font-semibold mt-3">
          Pick a starting point <span className="text-white/45">— wheel it.</span>
        </h2>
        <div className="mt-6 flex items-center gap-3 text-white/70">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_18px_rgba(244,63,94,.5)]" />
          <span className="text-sm">{active + 1} / {BASE.length}</span>
        </div>
      </div>

      {/* Wheel */}
      <div
        ref={viewRef}
        className="mt-10 px-12 md:px-16 overflow-x-auto overflow-y-hidden scroll-smooth"
        style={{ perspective: "1200px", WebkitOverflowScrolling: "touch" }}
      >
        <div className="inline-flex gap-10 pb-12">
          {items.map((t, i) => (
            <div
              key={`${t.id}-${i}`}
              ref={(el) => el && (cardRefs.current[i] = el)}
              className="group flex-none w-[min(78vw,520px)] md:w-[min(56vw,620px)]"
              style={{ transformOrigin: "50% 60%" }}
            >
              <div className="rounded-2xl border border-white/12 bg-white/[0.04] ring-1 ring-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur-md p-4">
                {/* Cinematic slot — nothing gets cropped */}
                <div className="rounded-xl border border-dashed border-white/25 bg-neutral-900/40 aspect-[21/9] grid place-items-center">
                  <span className="text-white/60 text-base">drop image / video</span>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/75 text-sm">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-400" />
                    ready to customize
                  </div>
                  <button
                    className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition"
                    type="button"
                  >
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
