import React, { useEffect, useMemo, useRef, useState } from "react";

type Slide = {
  src: string;
  alt?: string;
  caption?: string;
};

type Viewport = {
  /** Rectangle of the visible area inside the frame, in PIXELS of the frame’s original/native size */
  top: number;
  left: number;
  width: number;
  height: number;
};

interface Props {
  frameSrc: string;               // e.g. "/art/window-frame.png"
  viewport: Viewport;             // inner rectangle in the frame
  slides: Slide[];                // images to scroll through
  durationVh?: number;            // page scroll length per slide (default 120vh)
  className?: string;
}

export default function ScrollWindowShowcase({
  frameSrc,
  viewport,
  slides,
  durationVh = 120,
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLImageElement>(null);

  const [progress, setProgress] = useState(0); // 0..1 through the whole sequence
  const [frameNatural, setFrameNatural] = useState<{ w: number; h: number } | null>(null);

  // read the natural (intrinsic) size of the frame to scale viewport accurately
  useEffect(() => {
    const img = frameRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth) {
      setFrameNatural({ w: img.naturalWidth, h: img.naturalHeight });
    } else {
      const onLoad = () => setFrameNatural({ w: img.naturalWidth, h: img.naturalHeight });
      img.addEventListener("load", onLoad, { once: true });
      return () => img.removeEventListener("load", onLoad);
    }
  }, [frameSrc]);

  // progress from page scroll
  useEffect(() => {
    const wrap = wrapRef.current;
    const sticky = stickyRef.current;
    if (!wrap || !sticky) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const wrapRect = wrap.getBoundingClientRect();
        const stickyRect = sticky.getBoundingClientRect();
        const total = wrapRect.height - stickyRect.height;
        const traveled = Math.min(Math.max(-wrapRect.top, 0), Math.max(total, 1));
        setProgress(traveled / Math.max(total, 1));
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
  }, []);

  // computed sizes: scale viewport rect to the current rendered frame size
  const scaled = useMemo(() => {
    const img = frameRef.current;
    if (!img || !frameNatural) return null;

    const scaleX = img.clientWidth / frameNatural.w;
    const scaleY = img.clientHeight / frameNatural.h;
    const x = viewport.left * scaleX;
    const y = viewport.top * scaleY;
    const w = viewport.width * scaleX;
    const h = viewport.height * scaleY;
    return { x, y, w, h };
  }, [viewport, frameNatural, progress]);

  // translate the inner track by progress
  const translateY = useMemo(() => {
    if (!scaled) return 0;
    const travel = (slides.length - 1) * scaled.h; // move one viewport per slide
    return -progress * travel;
  }, [scaled, progress, slides.length]);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full ${className}`}
      style={{ height: `${Math.max(slides.length, 1) * durationVh}vh` }}
      aria-label="YBuilt demo window scroller"
    >
      <div ref={stickyRef} className="sticky top-24 md:top-28">
        <div className="relative w-full max-w-6xl mx-auto">
          {/* FRAME (on top) */}
          <img
            ref={frameRef}
            src={frameSrc}
            alt=""
            className="w-full h-auto block select-none pointer-events-none relative z-20"
            draggable={false}
          />

          {/* INNER VIEWPORT (under the frame) */}
          {scaled && (
            <div
              className="absolute overflow-hidden rounded-sm z-10"
              style={{
                left: scaled.x,
                top: scaled.y,
                width: scaled.w,
                height: scaled.h,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)", // subtle inner edge if center isn’t transparent
                background: "black", // good for high-contrast slides
              }}
              aria-hidden
            >
              {/* Slide track */}
              <div
                className="will-change-transform"
                style={{
                  width: "100%",
                  height: scaled.h * slides.length,
                  transform: `translate3d(0, ${translateY}px, 0)`,
                  transition: "transform 0.06s linear", // tiny smoothing
                }}
              >
                {slides.map((s, i) => (
                  <figure
                    key={i}
                    className="relative w-full"
                    style={{ height: scaled.h }}
                  >
                    <img
                      src={s.src}
                      alt={s.alt ?? ""}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                    {s.caption && (
                      <figcaption className="absolute left-3 right-3 bottom-3 text-xs md:text-sm text-white/90 bg-black/45 backdrop-blur-sm px-3 py-2 rounded">
                        {s.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
