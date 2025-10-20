// client/src/components/ScrollGallery.tsx
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  images: string[];
  /** Space for your fixed header; tweak if needed */
  topOffset?: number; // px
  /** Scroll distance per image, in viewport heights */
  stepVh?: number;
};

/**
 * Hard-cut scroll gallery (no fades, no crossfades).
 * Renders a single <img> at a time and swaps on index change.
 */
export default function ScrollGallery({
  images,
  topOffset = 88,
  stepVh = 120, // ~1.2 screens per image
}: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Total height of the scroll "track"
  const tallVh = useMemo(() => Math.max(1, images.length) * stepVh, [images.length, stepVh]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const onScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const viewH = window.innerHeight || 800;

      // Distance during which the sticky frame is "playing"
      const scrollable = Math.max(1, sectionRef.current.offsetHeight - viewH);

      // Progress 0 → 1 across the whole tall section
      const progress = Math.min(1, Math.max(0, (-rect.top) / scrollable));

      // Map progress to image index (hard cut)
      const rawIdx = Math.floor(progress * images.length);
      const clamped = Math.min(Math.max(rawIdx, 0), Math.max(0, images.length - 1));

      setIndex(clamped);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [images.length]);

  if (!images || images.length === 0) {
    return null;
  }

  const current = images[index] ?? images[images.length - 1];

  return (
    <section className="window-band py-20 sm:py-24">
      <div
        ref={sectionRef}
        className="relative window-layer"
        style={{ height: `${tallVh}vh` }}
        aria-label="YBuilt museum slides"
      >
        {/* Pinned stage */}
        <div className="gallery-sticky" style={{ top: topOffset }}>
          <div className="gallery-frame">
            <img
              key={current} // force a hard swap; prevents any sneaky transitions
              src={current}
              alt=""
              className="block w-full h-full object-cover select-none pointer-events-none"
              style={{ transition: "none" }}
              draggable={false}
              loading="eager"
              decoding="async"
            />
            {/* Optional hint */}
            <div
              style={{ position: "absolute", right: 14, bottom: 12 }}
              className="text-white/70 text-[11px] tracking-wide px-2 py-1 rounded bg-black/30"
            >
              scroll to advance
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
