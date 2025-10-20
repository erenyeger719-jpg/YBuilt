import ScrollWindowShowcase from "@/components/ScrollWindowShowcase";

export default function VintageWindowSection() {
  // Set this to the *inner* rectangle of your frame image (its native pixels).
  // Tweak once and forget.
  const viewport = { top: 72, left: 18, width: 1280, height: 720 };

  // Add at least 6 images; you can add more later.
  const slides = [
    { src: "/demo/ybuilt-01.jpg", caption: "Drop your workflow. YBuilt maps steps & I/O." },
    { src: "/demo/ybuilt-02.jpg", caption: "Arrange lanes. Connect tools, data, roles." },
    { src: "/demo/ybuilt-03.jpg", caption: "Wire paths. Branch with guards." },
    { src: "/demo/ybuilt-04.jpg", caption: "Test runs with sample data." },
    { src: "/demo/ybuilt-05.jpg", caption: "Package as an internal micro-app." },
    { src: "/demo/ybuilt-06.jpg", caption: "Share. Add auth. Iterate fast." },
  ];

  return (
    <section className="window-band relative py-20 md:py-28 overflow-hidden">
      {/* keep existing geometry pieces UNDER the window */}
      <div className="geom geom--rect geom-ivory geom--stroke"
           style={{ width: 220, height: 120, left: "8%", top: 40, transform: "rotate(-3deg)" }} />
      <div className="geom geom--pill geom-cobalt"
           style={{ width: 340, height: 52, right: "10%", top: 100, transform: "rotate(6deg)" }} />
      <div className="geom geom--triangle geom-verm"
           style={{ width: 160, height: 140, left: "18%", bottom: 80, transform: "rotate(-8deg)" }} />

      {/* title updated to match the scene */}
      <div className="relative window-layer max-w-6xl mx-auto px-4 md:px-6 mb-10 md:mb-12">
        <h2 className="text-white/95 text-2xl md:text-4xl font-semibold tracking-tight">
          Inside the Vintage Window — YBuilt in Action
        </h2>
        <p className="text-white/80 mt-2 md:mt-3">
          Scroll the page; the window updates step-by-step.
        </p>
      </div>

      {/* pinned window on TOP of geometries */}
      <div className="relative window-layer">
        <ScrollWindowShowcase
          frameSrc="/art/window-frame.png"     // put your PNG (transparent center) in /public/art/
          viewport={viewport}
          slides={slides}
          durationVh={120}                     // 6 slides = ~720vh of scroll before you exit
        />
      </div>
    </section>
  );
}
