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
  return { ok: bytes <= PAGE_BUDGET_BYTES, bytes, overBy: Math.max(0, bytes - PAGE_BUDGET_BYTES) };
}

export function downgradeSections(sections: string[]) {
  const down: Record<string, string> = {
    "features-3col": "cta-simple",
    "pricing-simple": "cta-simple",
  };
  return sections.map((s) => down[s] || s);
}

// Decide if we should strip JS for this page composition.
// Allowlist any sections that *require* JS to function.
export function shouldStripJS(sections: string[]) {
  const allow = new Set(["faq-accordion"]); // allowlist if needed
  return !sections.some((s) => allow.has(String(s).split("@")[0]));
}
