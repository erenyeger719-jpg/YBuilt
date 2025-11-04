// server/perf/budgets.ts
export const SECTION_BUDGET_BYTES: Record<string, number> = {
  "hero-basic": 8000,
  "features-3col": 16000,
  "pricing-simple": 12000,
  "faq-accordion": 10000,
  "cta-simple": 6000,
};

export const PAGE_BUDGET_BYTES = 45_000;

export function estimateBytes(sections: string[]) {
  let total = 0;
  for (const s of sections) total += SECTION_BUDGET_BYTES[s] ?? 8000;
  return total;
}

export function checkPerfBudget(sections: string[]) {
  const bytes = estimateBytes(sections);
  return {
    ok: bytes <= PAGE_BUDGET_BYTES,
    bytes,
    overBy: Math.max(0, bytes - PAGE_BUDGET_BYTES),
  };
}

export function downgradeSections(sections: string[]) {
  const down: Record<string, string> = {
    "features-3col": "cta-simple",
    "pricing-simple": "cta-simple",
  };
  return sections.map((s) => down[s] || s);
}

// Decide if we should strip JS for this page based on env + perf.
// Pure + easy to test.
export function shouldStripJS(
  perf: { jsBytes?: number; lcpMs?: number; cls?: number } | null | undefined
): boolean {
  // 1) Global env override: NO_JS_DEFAULT=1 / true / yes / on
  const flag = String(process.env.NO_JS_DEFAULT || "").toLowerCase();
  const envNoJs =
    flag === "1" || flag === "true" || flag === "yes" || flag === "on";

  // 2) Basic perf signals (safe defaults if perf is missing)
  const jsBytes = perf?.jsBytes ?? 0; // total JS weight in bytes
  const lcpMs = perf?.lcpMs ?? 0;     // LCP in ms
  const cls = perf?.cls ?? 0;         // CLS score

  const jsKb = jsBytes / 1024;

  // 3) "Obviously bad" perf threshold.
  //    Deterministic + tweakable later if needed.
  const jsTooHeavy = jsKb > 400;   // > 400KB JS
  const lcpTooSlow = lcpMs > 4000; // > 4s LCP
  const clsTooHigh = cls > 0.25;   // janky layout

  const badPerf = jsTooHeavy || lcpTooSlow || clsTooHigh;

  // 4) Final decision: env override OR clearly bad perf
  return envNoJs || badPerf;
}
