import { useEffect, useRef, useState } from "react";

type ScrollGalleryProps = {
  images: string[];            // e.g. ["/demo/ybuilt-01.jpg", ...]
  className?: string;          // optional extra classes
  fadeMs?: number;             // default 500ms
};

export default function ScrollGallery({
  images,
  className = "",
  fadeMs = 500,
}: ScrollGalleryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(0);
  const [scrollLen, setScrollLen] = useState(1);
  const [progress, setProgress] = useState(0);

  // measure section
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const pageY = window.scrollY || window.pageYOffset;
      const sectionTop = rect.top + pageY;
      // Scroll length is total spacer height minus one viewport (pinned time)
      const length = Math.max(1, el.offsetHeight - window.innerHeight);
      setStart(sectionTop);
      setScrollLen(length);
    };

    measure();
    window.addEventListener("resize", measure);
    // small timeout helps Safari after address bar collapse
    const t = setTimeout(measure, 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [images.length]);

  // scroll → progress (0..1)
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const raw = (y - start) / scrollLen;
        const clamped = Math.min(1, Math.max(0, raw));
        setProgress(clamped);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [start, scrollLen]);

  if (!images || images.length === 0) return null;

  // segment math for crossfade
  const segments = Math.max(1, images.length - 1);
  const seg = 1 / segments;
  const idx = Math.min(
    images.length - 1,
    Math.max(0, Math.floor(progress / seg))
  );
  const localT =
    segments === 1 ? progress : (progress - idx * seg) / seg;

  return (
    <section
      className={`window-band ${className}`}
      // give enough scroll to show all frames: 100vh per image
    >
      <div
        ref={ref}
        className="relative"
        style={{ height: `${images.length * 100}vh` }}
      >
        <div className="sticky top-0 h-[100svh] window-layer">
          {/* Stack all slides and crossfade only the two relevant frames */}
          <div className="relative w-full h-full">
            {images.map((src, i) => {
              // opacity: active and next frame crossfade, others hidden
              let opacity = 0;
              if (i === idx) opacity = 1 - localT;
              if (i === idx + 1) opacity = localT;
              if (segments === 1 && i === 0) opacity = 1 - localT;
              if (segments === 1 && i === 1) opacity = localT;

              return (
                <img
                  key={src + i}
                  src={src}
                  alt={`YBuilt slide ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-contain [image-rendering:auto] will-change-opacity"
                  style={{
                    opacity,
                    transition: `opacity ${fadeMs}ms linear`,
                  }}
                  draggable={false}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
