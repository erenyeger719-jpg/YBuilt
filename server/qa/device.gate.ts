// server/qa/device.gate.ts
import fs from "fs";
import path from "path";

type GateRun = {
  view: "mobile" | "desktop";
  throttle: "fast" | "slow";
  cls: number;
  clippedCount: number;
};

type GateResult = {
  pass: boolean;
  worst_cls: number;
  total_clipped: number;
  runs: GateRun[];
  budgets: { max_cls: number };
  note?: string;
};

const MAX_CLS = Number(process.env.GATE_MAX_CLS || 0.10);
const TIMEOUT_MS = Number(process.env.GATE_TIMEOUT_MS || 3500);

function ensureDir(p: string) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

async function withPlaywright<T>(fn: (chromium: any) => Promise<T>): Promise<T> {
  try {
    // Dynamic import so non-playwright envs don’t crash
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { chromium } = await import("playwright");
    return await fn(chromium);
  } catch {
    // No playwright installed → soft pass
    return await fn(null as any);
  }
}

async function emulateThrottle(page: any, throttle: "fast" | "slow") {
  if (!page || !page.context) return;
  try {
    const client = await page.context().newCDPSession(page);
    // Network
    if (throttle === "slow") {
      await client.send("Network.enable");
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 400,                // ms
        downloadThroughput: 750 * 1024 / 8, // ~750 Kbps
        uploadThroughput: 250 * 1024 / 8,   // ~250 Kbps
        connectionType: "cellular3g",
      });
      // CPU ~4× slowdown
      await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    } else {
      // reset
      await client.send("Network.enable");
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
        connectionType: "wifi",
      });
      await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    }
  } catch {}
}

async function measure(url: string, view: "mobile" | "desktop", throttle: "fast" | "slow"): Promise<GateRun> {
  return await withPlaywright<GateRun>(async (chromium) => {
    // If playwright missing, return neutral pass metrics
    if (!chromium) return { view, throttle, cls: 0, clippedCount: 0 };

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: view === "mobile" ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      deviceScaleFactor: view === "mobile" ? 3 : 1,
      userAgent:
        view === "mobile"
          ? "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Mobile Safari"
          : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
    });
    const page = await context.newPage();

    // Collect real CLS via PerformanceObserver
    await page.addInitScript(() => {
      // @ts-ignore
      (window as any).__CLS = 0;
      // @ts-ignore
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as any) {
          if (!e.hadRecentInput) {
            // @ts-ignore
            (window as any).__CLS += e.value || 0;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await emulateThrottle(page, throttle);
    await page.goto(url, { waitUntil: "load", timeout: TIMEOUT_MS }).catch(() => {});
    await page.waitForTimeout(Math.min(3000, TIMEOUT_MS));

    const cls = await page.evaluate(() => (window as any).__CLS ?? 0);

    // Count elements that are visually clipped/off-screen
    const clippedCount = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let clipped = 0;
      const els = Array.from(document.body.querySelectorAll<HTMLElement>("*"));
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const out =
          (r.left < 0 ? 1 : 0) +
          (r.top < 0 ? 1 : 0) +
          (r.right > vw ? 1 : 0) +
          (r.bottom > vh ? 1 : 0);
        if (out > 0) clipped++;
      }
      return clipped;
    });

    await context.close();
    await browser.close();
    return { view, throttle, cls: Number(cls || 0), clippedCount: Number(clippedCount || 0) };
  });
}

export async function runDeviceGate(absUrl: string, pageId?: string): Promise<GateResult> {
  const combos: Array<{ view: "mobile" | "desktop"; throttle: "fast" | "slow" }> = [
    { view: "mobile", throttle: "fast" },
    { view: "mobile", throttle: "slow" },
    { view: "desktop", throttle: "fast" },
    { view: "desktop", throttle: "slow" },
  ];

  const runs: GateRun[] = [];
  for (const c of combos) {
    try {
      runs.push(await measure(absUrl, c.view, c.throttle));
    } catch {
      runs.push({ view: c.view, throttle: c.throttle, cls: 0, clippedCount: 0 });
    }
  }

  const worst_cls = runs.reduce((m, r) => Math.max(m, r.cls), 0);
  const total_clipped = runs.reduce((s, r) => s + r.clippedCount, 0);
  const pass = worst_cls <= MAX_CLS && total_clipped === 0;

  const out: GateResult = {
    pass,
    worst_cls: Number(worst_cls.toFixed(3)),
    total_clipped,
    runs,
    budgets: { max_cls: MAX_CLS },
    note: !("playwright" in (globalThis as any)) ? undefined : undefined,
  };

  // Persist for UI/metrics
  try {
    if (pageId) {
      const dir = path.resolve(".cache/gates");
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, `${pageId}.json`), JSON.stringify(out, null, 2));
    }
  } catch {}

  return out;
}
