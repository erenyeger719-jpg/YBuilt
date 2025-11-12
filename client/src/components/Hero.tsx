// client/src/components/Hero.tsx
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// client/src/components/Hero.tsx

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white text-black">
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col justify-between px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* TOP: headline + trust copy */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)] lg:items-start">
          {/* LEFT: giant headline */}
          <div className="relative">
            <h1
              className="text-left uppercase font-extrabold leading-[0.8] text-[clamp(3.8rem,7.6vw,6.2rem)] tracking-[0.03em]"
              style={{ fontFamily: '"AmericanCaptain", system-ui, sans-serif' }}
            >
              <span className="block">BUILD</span>
              <span className="block">SMARTER</span>
              <span className="block">LAUNCH</span>
              <span className="block">FASTER</span>
            </h1>
          </div>

          {/* RIGHT: trust / marketing copy */}
          <div className="flex items-start">
            <div className="max-w-xs lg:ml-auto lg:pt-6 text-right lg:text-left text-[13px] leading-relaxed tracking-tight">
              <p className="mb-3 font-medium">
                A focused product studio for people who want{" "}
                <span className="font-semibold">real, working apps and sites</span>,
                not just nice-looking mockups.
              </p>
              <p className="text-neutral-600">
                Ybuilt gives you a single AI-assisted space to go from idea to
                live product — UI, logic, and deployment in one flow — so you
                can launch functional platforms, websites, and tools without
                needing a full engineering team.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM: full-width stripes (Cappen-style) */}
      <div className="mt-12 relative left-1/2 w-screen -translate-x-1/2 border-t border-black pt-6">
        <div className="flex flex-col space-y-3 px-0">
          {/* thickness ratio 1 : 2 : 3 : 9 */}
          <div className="h-[2px] w-full bg-black" />
          <div className="h-[4px] w-full bg-black" />
          <div className="h-[6px] w-full bg-black" />
          <div className="h-[18px] w-full bg-black" />
        </div>
      </div>
    </section>
  );
}