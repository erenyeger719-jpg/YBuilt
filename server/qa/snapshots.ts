// server/qa/snapshots.ts
import fs from "fs";
import path from "path";

type Issue = { type: "layout" | "image" | "a11y" | "perf"; msg: string; where: string };

const PROFILES = [
  { name: "mobile", width: 375, height: 667, deviceScaleFactor: 3 },
  { name: "tablet", width: 820, height: 1180, deviceScaleFactor: 2 },
  { name: "desktop", width: 1366, height: 900, deviceScaleFactor: 1 },
];

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Snapshot a page across 3 engines × 3 sizes.
 * Saves screenshots to .cache/snaps and returns heuristic issues.
 *
 * Lazy-loads Playwright to avoid boot failures when binaries aren't present.
 */
export async function runSnapshots(url: string, key: string) {
  const { chromium, firefox, webkit } = await import("playwright");

  const BROWSERS = [
    { name: "chromium", type: chromium },
    { name: "firefox", type: firefox },
    { name: "webkit", type: webkit },
  ];

  const outDir = path.resolve(".cache/snaps");
  ensureDir(outDir);

  const issues: Issue[] = [];

  for (const { name: bname, type } of BROWSERS) {
    const browser = await type.launch({ headless: true });
    try {
      for (const prof of PROFILES) {
        const ctx = await browser.newContext({
          viewport: { width: prof.width, height: prof.height },
          deviceScaleFactor: prof.deviceScaleFactor,
        });
        const page = await ctx.newPage();

        try {
          await page.goto(url, { waitUntil: "load", timeout: 20000 });

          // Horizontal scroll is a red flag for layout shifts
          const hasHScroll = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
          );
          if (hasHScroll) {
            issues.push({
              type: "layout",
              msg: "Horizontal scrolling detected (potential overflow)",
              where: `${bname}/${prof.name}`,
            });
          }

          // Stretchy images: client size wildly larger than natural size
          const stretchedCount = await page.evaluate(() => {
            let bad = 0;
            for (const img of Array.from(document.images)) {
              const el = img as HTMLImageElement;
              const cw = el.clientWidth || 0;
              const nw = el.naturalWidth || 0;
              if (nw && cw / nw > 2.5) bad++;
            }
            return bad;
          });
          if (stretchedCount > 0) {
            issues.push({
              type: "image",
              msg: `${stretchedCount} overscaled images`,
              where: `${bname}/${prof.name}`,
            });
          }

          // Basic perf: bytes transferred if available
          const bytes = await page.evaluate(() => {
            try {
              const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
              const sum = entries.reduce((s, e) => s + (e.transferSize || 0), 0);
              return sum;
            } catch {
              return null;
            }
          });
          if (typeof bytes === "number" && bytes > 1_200_000) {
            issues.push({
              type: "perf",
              msg: `High transfer size ~${Math.round(bytes / 1024)} KB`,
              where: `${bname}/${prof.name}`,
            });
          }

          const snapPath = path.join(outDir, `${key}-${bname}-${prof.name}.png`);
          await page.screenshot({ path: snapPath, fullPage: true });
        } catch (e) {
          issues.push({
            type: "perf",
            msg: `load_error:${(e as Error).message || "unknown"}`,
            where: `${bname}/${prof.name}`,
          });
        } finally {
          await ctx.close();
        }
      }
    } finally {
      await browser.close();
    }
  }

  return { issues };
}
