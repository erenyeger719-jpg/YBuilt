'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Step = { id: string; title: string; body: string };

const STEPS: Step[] = [
  { id: 's1', title: 'Design the Flow', body: 'Sketch your workflow with nodes, wires, and guardrails.' },
  { id: 's2', title: 'Bind Real Data', body: 'Connect actions to data and turn mocks into living parts.' },
  { id: 's3', title: 'Refine Interactions', body: 'Micro-transitions, edge cases, and safe fallbacks.' },
  { id: 's4', title: 'Ship App Mode', body: 'One click: the flow compiles into a production UI.' },
];

export default function WorkflowToApp() {
  const [active, setActive] = useState(0);
  const leftRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // watch which step is in view
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
    const io = new IntersectionObserver(
      (entries) => {
        // pick the most visible
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];
        if (!vis) return;
        const idx = items.findIndex((el) => el === vis.target);
        if (idx >= 0) setActive(idx);
      },
      { rootMargin: '-20% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const mode = active >= 2 ? 'app' : 'workflow';

  return (
    <section className="relative bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-24 md:py-32 grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* left: sticky morphing canvas */}
        <div className="relative" style={{ height: '1200px' }}>
          <div className="sticky top-24">
            <div
              ref={leftRef}
              className="relative rounded-2xl card-glass gloss-sheen overflow-hidden"
              style={{
                height: 520,
                backdropFilter: 'blur(14px) saturate(140%)',
                boxShadow: '0 30px 80px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.06)',
                transition: 'border-radius 400ms ease, transform 400ms ease, background 400ms ease',
                borderRadius: mode === 'app' ? 24 : 16,
                transform: mode === 'app' ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
                background:
                  mode === 'app'
                    ? 'linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))'
                    : 'linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04))',
              }}
            >
              {/* ambient glow */}
              <div
                className="absolute -inset-20 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(40rem 24rem at 50% 30%, hsl(var(--accent)/.20), transparent 60%)',
                  mixBlendMode: 'screen',
                }}
              />

              {mode === 'workflow' ? <WorkflowMock /> : <AppMock />}
            </div>
            <div className="mt-6 text-sm text-slate-500">
              From <span className="font-medium">Workflow</span> to <span className="font-medium">App Mode</span>
            </div>
          </div>
        </div>

        {/* right: steps list */}
        <div ref={listRef} className="flex flex-col gap-12">
          <header>
            <div className="text-xs tracking-[0.28em] uppercase text-slate-500">How it compiles</div>
            <h2 className="h-display text-4xl md:text-5xl metal-text">From Workflow to App Mode</h2>
          </header>

          {STEPS.map((s, i) => (
            <article
              key={s.id}
              data-step
              className={`rounded-xl border p-5 md:p-6 hover-elevate transition-all ${
                i === active ? 'bg-[hsl(var(--accent)/.06)] border-[hsl(var(--accent))]' : 'bg-white'
              }`}
            >
              <div className="text-[11px] tracking-[.22em] uppercase text-slate-500">Step {i + 1}</div>
              <h3 className="text-xl font-semibold mt-1">{s.title}</h3>
              <p className="text-slate-600 mt-2">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowMock() {
  // simplified: 3 big nodes + wires, matching the vibe under the board
  return (
    <div className="absolute inset-0">
      <svg className="absolute inset-0" width="100%" height="100%" viewBox="0 0 1000 520" preserveAspectRatio="none">
        <defs>
          <filter id="wfShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0b0f14" floodOpacity="0.18" />
          </filter>
        </defs>
        <path d="M200 240 C 320 240 380 260 480 260" stroke="#CBD5E1" strokeWidth="2.5" fill="none" filter="url(#wfShadow)" />
        <path d="M520 260 C 650 260 700 280 800 300" stroke="#CBD5E1" strokeWidth="2.5" fill="none" filter="url(#wfShadow)" />
        <path d="M520 260 C 520 320 520 360 520 420" stroke="#CBD5E1" strokeWidth="2.5" fill="none" filter="url(#wfShadow)" />
      </svg>

      <div className="absolute left-16 top-160 node-card" style={{ width: 220, height: 140 }}>
        <div className="node-label">Prompt</div>
        <div className="slot-media"><div className="placeholder">drop</div></div>
      </div>
      <div className="absolute left-[420px] top-[180px] node-card" style={{ width: 240, height: 160 }}>
        <div className="node-label">Weaver</div>
        <div className="slot-media"><div className="placeholder">drop</div></div>
      </div>
      <div className="absolute right-10 top-[220px] node-card" style={{ width: 260, height: 160 }}>
        <div className="node-label">Preview</div>
        <div className="slot-media"><div className="placeholder">drop</div></div>
      </div>
      <div className="absolute left-[460px] bottom-6 node-card" style={{ width: 220, height: 140 }}>
        <div className="node-label">Launch</div>
        <div className="slot-media"><div className="placeholder">drop</div></div>
      </div>
    </div>
  );
}

function AppMock() {
  // a lightweight “compiled app”: top bar + sidebar + cards
  return (
    <div className="absolute inset-0 bg-[rgba(255,255,255,.04)]">
      <div className="h-12 border-b flex items-center gap-3 px-4">
        <div className="h-5 w-5 rounded-md bg-[hsl(var(--accent)/.35)]" />
        <div className="text-sm text-slate-300">Ybuilt App</div>
      </div>
      <div className="h-full grid grid-cols-[200px_1fr]">
        <aside className="border-r p-4 space-y-2">
          {['Dashboard', 'Content', 'Orders', 'Analytics'].map((t, i) => (
            <div
              key={t}
              className={`px-3 py-2 rounded-md text-sm ${
                i === 0 ? 'bg-[hsl(var(--accent)/.18)] text-white' : 'hover-elevate text-slate-300'
              }`}
            >
              {t}
            </div>
          ))}
        </aside>
        <main className="p-6 grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="card-glass gloss-sheen rounded-xl p-5">
              <div className="text-sm text-slate-300">Widget {n}</div>
              <div className="mt-3 h-28 rounded-md bg-white/5 border" />
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
