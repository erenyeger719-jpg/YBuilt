// client/src/components/ScrollGallery.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type Props = {
  images: string[];
  /** "contain" preserves artwork; "cover" goes edge-to-edge */
  fit?: "contain" | "cover";
  /** Optional aria-label for the section */
  label?: string;
};

export default function ScrollGallery({ images, fit = "contain", label = "YBuilt demo gallery" }: Props) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(0);

  // Height rule: N slides => N * 100vh scroll distance
  const totalVh = useMemo(() => Math.max(1, images.length) * 100, [images.length]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      // schedule to avoid layout thrash
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
        const progress = total > 0 ? scrolled / total : 0;
        // which slide are we on?
        const idx = Math.min(images.length - 1, Math.floor(progress * images.length));
        setActive(idx);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [images.length]);

  return (
    <section
      ref={sectionRef as any}
      aria-label={label}
      // IMPORTANT: red paper band background + paper grain
      className={clsx(
        "window-band relative",
        "z-[30]",               // above stray geometries
        "w-full",
      )}
      style={{ height: `${totalVh}vh` }}
    >
      {/* Sticky viewport */}
      <div className="window-layer sticky top-0 h-screen w-full overflow-hidden">
        {/* Safe padding so artwork breathes; tweak to taste */}
        <div className="relative mx-auto h-full w-full max-w-[1400px] px-4 md:px-8">
          {/* Stack all slides and fade the active one in */}
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt="" // decorative
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
              className={clsx(
                "absolute inset-0 m-auto h-full w-full select-none",
                fit === "cover" ? "object-cover" : "object-contain",
                "transition-opacity duration-500 ease-out will-change-opacity",
                i === active ? "opacity-100" : "opacity-0"
              )}
              style={{ zIndex: i === active ? 2 : 1 }}
            />
          ))}

          {/* Optional tiny affordance */}
          <div
            className="pointer-events-none absolute bottom-4 right-4 rounded-full px-3 py-1 text-[11px] tracking-wide"
            style={{
              background: "rgba(255,255,255,0.16)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
          >
            scroll to advance
          </div>
        </div>
      </div>
    </section>
  );
}
