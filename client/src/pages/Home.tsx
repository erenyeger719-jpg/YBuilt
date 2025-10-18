import { useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Rocket, Wand2, MonitorSmartphone } from "lucide-react";

/** Reuse the Studio look on Home */
function useForceStudioTheme(enable: boolean) {
  useEffect(() => {
    if (enable) document.body.dataset.forceTheme = "studio";
    return () => { delete document.body.dataset.forceTheme; };
  }, [enable]);
}

/** Scene FX: pointer glow, scroll-stop scrubbing, magnetic + tilt (scoped to .home-root) */
function useSceneFX() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".home-root");
    if (!root) return;

    // pointer glow
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = root.getBoundingClientRect();
        const x = ((e.clientX - r.left) / Math.max(1, r.width)) * 100;
        const y = ((e.clientY - r.top) / Math.max(1, r.height)) * 100;
        root.style.setProperty("--mx", x.toFixed(2) + "%");
        root.style.setProperty("--my", y.toFixed(2) + "%");
      });
    };
    root.addEventListener("pointermove", onMove, { passive: true });

    // scroll stops
    let sraf = 0;
    const onScroll = () => {
      if (sraf) return;
      sraf = requestAnimationFrame(() => {
        sraf = 0;
        const max = document.documentElement.scrollHeight - innerHeight || 1;
        const p = Math.min(1, Math.max(0, scrollY / max));
        root.style.setProperty("--scroll", p.toFixed(3));
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // delegated magnetic + tilt
    let lastMag: HTMLElement | null = null;
    let lastTilt: HTMLElement | null = null;
    const onDelegated = (e: PointerEvent) => {
      const t = e.target as HTMLElement;

      const mag = t?.closest<HTMLElement>(".btn-magnetic");
      if (mag) {
        lastMag = mag;
        const b = mag.getBoundingClientRect();
        const x = e.clientX - (b.left + b.width / 2);
        const y = e.clientY - (b.top + b.height / 2);
        const clamp = (v: number) => Math.max(-24, Math.min(24, v));
        mag.style.setProperty("--tx", clamp(x * 0.15) + "px");
        mag.style.setProperty("--ty", clamp(y * 0.15) + "px");
      } else if (lastMag) {
        lastMag.style.setProperty("--tx", "0px");
        lastMag.style.setProperty("--ty", "0px");
        lastMag = null;
      }

      const tilt = t?.closest<HTMLElement>(".card-tilt");
      if (tilt) {
        lastTilt = tilt;
        const r = tilt.getBoundingClientRect();
        const px = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
        const py = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
        tilt.style.setProperty("--ry", (px * 7) + "deg");
        tilt.style.setProperty("--rx", (-py * 7) + "deg");
      } else if (lastTilt) {
        lastTilt.style.removeProperty("--rx");
        lastTilt.style.removeProperty("--ry");
        lastTilt = null;
      }
    };
    const onLeave = () => {
      if (lastMag) {
        lastMag.style.setProperty("--tx", "0px");
        lastMag.style.setProperty("--ty", "0px");
        lastMag = null;
      }
      if (lastTilt) {
        lastTilt.style.removeProperty("--rx");
        lastTilt.style.removeProperty("--ry");
        lastTilt = null;
      }
    };
    root.addEventListener("pointermove", onDelegated, { passive: true });
    root.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      root.removeEventListener("pointermove", onMove);
      removeEventListener("scroll", onScroll);
      root.removeEventListener("pointermove", onDelegated);
      root.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(sraf);
    };
  }, []);
}

export default function Home() {
  useForceStudioTheme(true);
  useSceneFX();

  return (
    <main className="studio-root home-root min-h-screen" data-force-theme="studio">
      {/* header floats above the glass */}
      <div className="relative z-10">
        <Header />
      </div>

      {/* HERO */}
      <section className="relative z-10 max-w-6xl mx-auto pt-20 px-6 text-center">
        <p className="h-tagline reveal-diag">BUILD FASTER</p>
        <h1 className="h-display reveal-diag mt-2" style={{ letterSpacing: "-0.02em" }}>
          Inside a living canvas
        </h1>
        <p className="mt-4 text-muted-foreground reveal-diag">
          Design a site or app, wire it to a real stack, and deploy—all in one flow.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Button className="btn btn-magnetic card-glass px-6 py-3 rounded-xl">
            Start a project
          </Button>
          <Button variant="secondary" className="btn btn-magnetic px-6 py-3 rounded-xl border">
            Watch demo
          </Button>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6 content-auto">
        <Feature
          icon={<Wand2 className="h-5 w-5" />}
          title="Design that breathes"
          text="Aurora canvas, glossy cards, and motion that reacts to you—not at you."
        />
        <Feature
          icon={<MonitorSmartphone className="h-5 w-5" />}
          title="Web + App ready"
          text="Prebuilt patterns for marketing sites, dashboards, and mobile shells."
        />
        <Feature
          icon={<Rocket className="h-5 w-5" />}
          title="Deploy in one click"
          text="Beginner → Pro → Business presets. Switch at any time."
        />
      </section>

      {/* STICKY BUILDER DEMO */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 mt-20 grid lg:grid-cols-2 gap-8">
        <Card className="card-glass card-tilt p-6 sticky top-24 self-start">
          <div className="gloss-sheen" />
          <div className="relative z-10">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> Live preview
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tiny simulation of your canvas while you scroll specs on the right.
            </p>

            {/* faux preview */}
            <div className="mt-4 rounded-xl overflow-hidden border">
              <div className="aspect-[16/10] studio-root" />
            </div>

            <div className="mt-4 flex gap-2">
              <Button className="btn btn-magnetic">Open Studio</Button>
              <Button variant="secondary" className="btn btn-magnetic border">See templates</Button>
            </div>
          </div>
        </Card>

        <ul className="space-y-6">
          {[
            ["Sketch", "Describe your idea. The AI drafts the plan & stack."],
            ["Shape", "Pick a theme and tweak sections—the canvas responds."],
            ["Wire", "Add data, auth, and routes. Zero config boilerplate."],
            ["Ship", "Choose a deploy preset or custom; we handle the rest."],
          ].map(([t, d], i) => (
            <li key={t} className="reveal-diag">
              <Card className="card-glass p-5">
                <div className="gloss-sheen" />
                <div className="relative z-10">
                  <div className="text-sm text-muted-foreground">Step {i + 1}</div>
                  <div className="text-lg font-semibold mt-1">{t}</div>
                  <p className="text-sm mt-1 text-muted-foreground">{d}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 mt-20 mb-24 text-center">
        <h2 className="h-display" style={{ letterSpacing: "-0.01em" }}>Ready to build?</h2>
        <p className="text-muted-foreground mt-2">
          Keep your theme. Gain the mechanisms.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button className="btn btn-magnetic card-glass px-6 py-3 rounded-xl">Start free</Button>
          <Button variant="secondary" className="btn btn-magnetic px-6 py-3 rounded-xl border">Talk to us</Button>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card className="card-glass card-tilt p-6">
      <div className="gloss-sheen" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon} <span>{title}</span></div>
        <p className="mt-2 text-sm">{text}</p>
      </div>
    </Card>
  );
}
