// server/config/guardrails.ts
// Central guardrail config: perf, SUP, readability, no-JS, etc.
// Tweak here when you tune after looking at real dashboards.

export type PerfGuardrails = {
  clsGoodMax: number;   // e.g. CLS <= 0.10
  lcpGoodMs: number;    // e.g. LCP <= 2500ms
};

export type ReadabilityGuardrails = {
  // Minimum acceptable readability score (0..100)
  minScore: number;
};

export type SupGuardrails = {
  // Target max bad ship rate (e.g. 0.005 = 0.5%)
  maxBadShipRate: number;
  // Target strict percentage; not a hard rule, just guidance.
  targetStrictPct: number;
};

export type NoJsGuardrails = {
  // When true, default to no-JS everywhere except whitelisted routes/components.
  defaultNoJs: boolean;
};

export const GUARDRAILS: {
  perf: PerfGuardrails;
  readability: ReadabilityGuardrails;
  sup: SupGuardrails;
  nojs: NoJsGuardrails;
} = {
  perf: {
    clsGoodMax: 0.10,
    lcpGoodMs: 2500,
  },
  readability: {
    // Soft baseline; can be tightened once you see how pages score.
    minScore: 30,
  },
  sup: {
    maxBadShipRate: 0.005, // 0.5%
    targetStrictPct: 0.10, // 10% strict as a starting target
  },
  nojs: {
    // Wire to env so you can flip this in prod without code changes.
    defaultNoJs: process.env.NO_JS_DEFAULT === "1",
  },
};
