'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Item = { id: string; title: string; tag?: string; img?: string };

const SAMPLE_ITEMS: Item[] = [
  { id: 't1', title: 'Modern Portfolio', tag: 'Portfolio' },
  { id: 't2', title: 'Shop Starter', tag: 'Commerce' },
  { id: 't3', title: 'Course Hub', tag: 'Education' },
  { id: 't4', title: 'Restaurant Kit', tag: 'Food' },
  { id: 't5', title: 'Agency Site', tag: 'Service' },
  { id: 't6', title: 'Podcast Home', tag: 'Media' },
  { id: 't7', title: 'Events Page', tag: 'Events' },
  { id: 't8', title: 'SaaS Landing', tag: 'SaaS' },
  { id: 't9', title: 'Personal Blog', tag: 'Writing' },
];

export default function ExploreWheel({ items = SAMPLE_ITEMS }: { items?: Item[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [itemW, setItemW] = useState(360); // rough; updated on mount

  // center-on-resize math
  useEffect(() => {
    const wrap = wrapRef.current;
    const s = scrollerRef.current;
    if (!wrap || !s) return;

    const ro = new ResizeObserver(() => {
      const w = Math.min(420, Math.max(300, Math.floor(wrap.clientWidth * 0.42)));
      setItemW(w);
      // keep current item centered after resize
      requestAnimationFrame(() => {
        // Nothing fancy; the transform visuals follow scrollLeft anyway
      });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // transform each card based on distance to center
  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return;

    let raf = 0;
    const tick = () => {
      const center = s.scrollLeft + s.clientWidth / 2;
      const cards = Array.from(s.querySelectorAll<HTMLElement>('[data-card]'));
      for (const el of cards) {
        const rect = el.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        const distPx = mid - (s.getBoundingClientRect().left + s.clientWidth / 2);
        const d = distPx / itemW; // -1..1-ish near center
        const curve = Math.max(0, 1 - Math.min(1, Math.abs(d))); // 1 at center → 0 outward
        const rise = Math.round(curve * 90);      // vertical lift
        const scale = 0.86 + curve * 0.18;        // 0.86 → 1.04
        const rot = d * -8;                       // gentle tilt
        const z = 100 + Math.round(curve * 100);  // bring center forward
        el.style.transform = `translateY(${-rise}px) rotate(${rot}deg) scale(${scale})`;
        el.style.zIndex = `${z}`;
        el.style.opacity = `${0.65 + curve * 0.35}`;
        el.style.filter = `drop-shadow(0 18px 30px rgba(0,0,0,${0.14 + curve * 0.18}))`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onScroll = () => {
      // no-op; continuous RAF handles transforms
    };
    s.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      s.removeEventListener('scroll', onScroll);
    };
  }, [itemW]);

  const next = (dir: 1 | -1) => {
    const s = scrollerRef.current;
    if (!s) return;
    const delta = (itemW + 24) * dir;
    s.scrollTo({ left: s.scrollLeft + delta, behavior: 'smooth' });
  };

  const cardBase =
    'relative card-glass gloss-sheen rounded-2xl overflow-hidden transition-transform duration-200 will-change-transform';

  return (
    <section className="relative bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6" ref={wrapRef}>
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="text-xs tracking-[0.28em] uppercase text-slate-500">Explore</div>
            <h2 className="h-display text-4xl md:text-5xl metal-text">Our Templates</h2>
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-full border px-4 py-2 hover-elevate active-elevate text-sm"
              onClick={() => next(-1)}
              aria-label="Previous"
            >
              ◀
            </button>
            <button
              className="rounded-full border px-4 py-2 hover-elevate active-elevate text-sm"
              onClick={() => next(1)}
              aria-label="Next"
            >
              ▶
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="relative flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory"
          style={{ scrollPadding: '15%', WebkitOverflowScrolling: 'touch' }}
        >
          {/* center guide (invisible) */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent" />

          {items.map((it, i) => (
            <article
              key={it.id}
              data-card
              className={`${cardBase} snap-center shrink-0`}
              style={{ width: itemW, height: Math.round(itemW * 0.66) }}
            >
              {/* backdrop / placeholder image */}
              <div className="absolute inset-0">
                {/* swap to <img src={it.img} .../> later */}
                <div
                  className="h-full w-full"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 50% 0%, hsl(var(--accent)/.26), transparent 55%), linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))',
                  }}
                />
              </div>

              {/* label */}
              <div className="absolute left-4 right-4 bottom-4">
                <div className="text-[11px] tracking-[.22em] uppercase text-slate-400">{it.tag}</div>
                <div className="text-lg md:text-xl text-slate-50 drop-shadow">{it.title}</div>
              </div>

              {/* rim light */}
              <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12)' }} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
