import { useEffect } from "react";

export function useStudioFX(rootSelector = ".studio-root") {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(rootSelector);
    if (!root) return;

    /* 1) Pointer glow (rAF-throttled) */
    let glowRAF = 0;
    const onPointerMove = (e: PointerEvent) => {
      if (glowRAF) return;
      glowRAF = requestAnimationFrame(() => {
        glowRAF = 0;
        const r = root.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        root.style.setProperty("--mx", x.toFixed(2) + "%");
        root.style.setProperty("--my", y.toFixed(2) + "%");
      });
    };
    root.addEventListener("pointermove", onPointerMove, { passive: true });

    /* 2) Scroll-scrub stops (rAF-throttled) */
    let scrollRAF = 0;
    const onScroll = () => {
      if (scrollRAF) return;
      scrollRAF = requestAnimationFrame(() => {
        scrollRAF = 0;
        const max = document.body.scrollHeight - innerHeight || 1;
        const p = Math.min(1, Math.max(0, scrollY / max));
        root.style.setProperty("--scroll", p.toFixed(3));
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // init

    /* 3) Magnetic buttons (scoped) */
    const mags = Array.from(root.querySelectorAll<HTMLElement>(".btn-magnetic"));
    const magHandlers = mags.map(btn => {
      const R = 24;
      const move = (e: PointerEvent) => {
        const b = btn.getBoundingClientRect();
        const x = e.clientX - (b.left + b.width / 2);
        const y = e.clientY - (b.top + b.height / 2);
        const clamp = (v: number) => Math.max(-R, Math.min(R, v));
        btn.style.setProperty("--tx", clamp(x * 0.15) + "px");
        btn.style.setProperty("--ty", clamp(y * 0.15) + "px");
      };
      const leave = () => {
        btn.style.setProperty("--tx", "0px");
        btn.style.setProperty("--ty", "0px");
      };
      btn.addEventListener("pointermove", move);
      btn.addEventListener("pointerleave", leave);
      return () => {
        btn.removeEventListener("pointermove", move);
        btn.removeEventListener("pointerleave", leave);
      };
    });

    /* 4) Tilted cards (scoped) */
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".card-tilt"));
    const tiltHandlers = cards.map(card => {
      const max = 7;
      const move = (e: PointerEvent) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--ry", (px * max) + "deg");
        card.style.setProperty("--rx", (-py * max) + "deg");
      };
      const leave = () => {
        card.style.removeProperty("--rx");
        card.style.removeProperty("--ry");
      };
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerleave", leave);
      return () => {
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerleave", leave);
      };
    });

    /* 5) Diagonal text reveal (IntersectionObserver) */
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => e.isIntersecting && e.target.classList.add("in"));
    }, { threshold: 0.25 });
    const reveals = Array.from(root.querySelectorAll<HTMLElement>(".reveal-diag"));
    reveals.forEach(n => io.observe(n));

    /* Cleanup */
    return () => {
      root.removeEventListener("pointermove", onPointerMove);
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(glowRAF);
      cancelAnimationFrame(scrollRAF);
      magHandlers.forEach(off => off());
      tiltHandlers.forEach(off => off());
      io.disconnect();
    };
  }, [rootSelector]);
}
