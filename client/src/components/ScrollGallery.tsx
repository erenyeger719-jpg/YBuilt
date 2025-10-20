// client/src/components/ScrollGallery.tsx
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  images: string[];
  topOffset?: number;  // px from top (keeps it tucked under the Wheel)
  stepVh?: number;     // scroll distance per slide
};

export default function ScrollGallery({
  images,
  topOffset = 88,
  stepVh = 120,
}: Props) {
  const pinRef = useRef<HTMLDivElement | null>(null);
  const [idx, setIdx] = useState(0);

  // Preload every slide once so swaps are instant
  useEffect(() => {
    let cancelled = false;
    const loaders = images.map((src) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // don’t block on errors
        img.src = src;
      });
    });
    Promise.all(loaders).then(() => {
      if (!cancelled) {
        // tiny nudge: if we were showing black on first scroll, force a repaint
        setIdx((v) => Math.min(v, images.length - 1));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [images]);

  // Sticky progress → slide index (hard cut)
  useEffect(() => {
    const onScroll = () => {
      if (!pinRef.current) return;
      const rectTop = pinRef.current.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const start = topOffset;
      const end = vh - topOffset;
      const denom = Math.max(1, end - start);

      // progress in [0..1]
      const t = Math.min(1, Math.max(0, (vh - rectTop - start) / denom));

      // map to index; subtract an epsilon so 1.0 never spills to length
      const raw = Math.floor(t * images.length - 1e-6);
      const next = Math.min(images.length - 1, Math.max(0, raw));
      if (next !== idx) setIdx(next);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [images.length, topOffset, idx]);

  const spacerHeight = useMemo(
    () => `${images.length * stepVh}vh`,
    [images.length, stepVh]
  );

  return (
    <section className="window-band">
      <div ref={pinRef} className="gallery-sticky" style={{ top: topOffset }}>
        <div className="gallery-frame window-layer">
          <img
            /* IMPORTANT: no `key` here—keeps the element mounted */
            src={images[idx]}
            alt=""
            className="block w-full h-full object-cover select-none pointer-events-none"
            decoding="sync"
            fetchPriority="high"
            loading="eager"
            draggable={false}
          />
          <div
            style={{ position: "absolute", right: 14, bottom: 12 }}
            className="text-white/70 text-[11px] tracking-wide px-2 py-1 rounded bg-black/30"
          >
            scroll to advance
          </div>
        </div>
      </div>
      <div style={{ height: spacerHeight }} />
    </section>
  );
}
