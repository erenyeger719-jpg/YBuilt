// server/qa/snapshots.ts
import fs from "fs";
import path from "path";

type Mode = { name: string; width: number; height: number; colorScheme: "light" | "dark" };

const MODES: Mode[] = [
  { name: "mobile-light",  width: 375,  height: 812,  colorScheme: "light" },
  { name: "mobile-dark",   width: 375,  height: 812,  colorScheme: "dark"  },
  { name: "desktop-light", width: 1280, height: 800,  colorScheme: "light" },
  { name: "desktop-dark",  width: 1280, height: 800,  colorScheme: "dark"  },
];

export async function runSnapshots(url: string, id?: string) {
  let chromium: any;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("playwright_missing");
  }

  const outDir = path.resolve(".cache/snapshots");
  await fs.promises.mkdir(outDir, { recursive: true });
  const label = id || Date.now().toString(36);
  const browser = await chromium.launch({ headless: true });

  const results: Array<{ mode: string; cls: number; lcp: number; overflowX: boolean; overflowY: boolean; ms: number; screenshot: string }> = [];

  try {
    for (const m of MODES) {
      const ctx = await browser.newContext({ viewport: { width: m.width, height: m.height }, colorScheme: m.colorScheme });
      const page = await ctx.newPage();

      // Collect CLS + LCP
      await page.addInitScript(() => {
        // @ts-ignore
        window.__CLS = 0;
        // @ts-ignore
        window.__LCP = 0;
        // @ts-ignore
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            // @ts-ignore
            if (!e.hadRecentInput) window.__CLS += e.value || 0;
          }
        }).observe({ type: "layout-shift", buffered: true });
        // @ts-ignore
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          // @ts-ignore
          if (last) window.__LCP = (last.renderTime || last.loadTime || last.startTime || 0);
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });

      const t0 = Date.now();
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(1500);

      const metrics = await page.evaluate(() => {
        const de = document.documentElement;
        const overflowX = (de.scrollWidth || 0) > (de.clientWidth || 0);
        const overflowY = (de.scrollHeight || 0) > (de.clientHeight || 0);
        // @ts-ignore
        const cls = Math.round(((window.__CLS || 0) + Number.EPSILON) * 1000) / 1000;
        // @ts-ignore
        const lcp = Math.round(window.__LCP || 0);
        return { overflowX, overflowY, cls, lcp };
      });

      const pngPath = path.join(outDir, `${label}-${m.name}.png`);
      await page.screenshot({ path: pngPath, fullPage: true });
      await ctx.close();

      results.push({ mode: m.name, ...metrics, ms: Date.now() - t0, screenshot: pngPath });
    }
  } finally {
    await browser.close();
  }

  // Simple thresholds → issues
  const issues = results.flatMap((r) => {
    const o: string[] = [];
    if (r.cls > 0.1) o.push(`${r.mode}: high CLS ${r.cls}`);
    if (r.lcp > 3000) o.push(`${r.mode}: slow LCP ${r.lcp}ms`);
    if (r.overflowX) o.push(`${r.mode}: horizontal overflow`);
    return o;
  });

  const summary = { url, id: label, results, issues, ts: Date.now() };
  await fs.promises.writeFile(path.join(outDir, `${label}.json`), JSON.stringify(summary, null, 2), "utf8");
  return summary;
}
