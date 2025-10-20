import { useEffect, useRef, useState } from "react";

type Props = {
  images: string[];
  /** space for your fixed header; tweak if needed */
  topOffset?: number; // px
};

export default function ScrollGallery({ images, topOffset = 88 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(0);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight || 800);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // make the section tall enough so the sticky frame can “play” all fades
  const tall = Math.max(1, images.length) * vh;

  return (
    <section className="window-band py-20 sm:py-24">
      <div
        ref={wrapRef}
        className="relative window-layer"
        style={{ height: tall }}
        aria-label="YBuilt museum slides"
      >
        {/* pinned stage */}
        <div className="gallery-sticky" style={{ top: topOffset }}>
          <div className="gallery-frame">
            {images.map((src, i) => (
              <FadeSlide
                key={src}
                index={i}
                total={images.length}
                src={src}
                wrapRef={wrapRef}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FadeSlide({
  index,
  total,
  src,
  wrapRef,
}: {
  index: number;
  total: number;
  src: string;
  wrapRef: React.RefObject<HTMLDivElement>;
}) {
  const [opacity, setOpacity] = useState(index === 0 ? 1 : 0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const viewH = window.innerHeight || 800;
      const scrollable = el.offsetHeight - viewH;

      // progress 0→1 across the whole tall section
      const progress = Math.min(1, Math.max(0, (-rect.top) / Math.max(1, scrollable)));

      // only two slides visible at a time: current & next
      const seg = progress * (total - 1);
      const cur = Math.floor(seg);
      const frac = seg - cur;

      let o = 0;
      if (index === cur) o = 1 - frac;
      else if (index === cur + 1) o = frac;

      setOpacity(o);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [index, total, wrapRef]);

  return (
    <img
      src={src}
      alt=""
      className="gallery-slide"
      style={{ opacity }}
      loading={index < 2 ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
