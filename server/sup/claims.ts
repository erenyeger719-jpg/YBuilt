// server/sup/claims.ts

export type ClaimKind =
  | "superlative"
  | "percent"
  | "multiplier"
  | "comparative"
  | "factual"
  | "testimonial";

export interface ClaimCounts {
  total: number;
  byKind: Record<ClaimKind, number>;
}

const SUPERLATIVE_RE =
  /\b(best|fastest|cheapest|#1|number one|leading|ultimate|unbeatable|world[- ]class|top-rated)\b/i;
const PERCENT_RE = /\b\d+\s*%|\bpercent\b/i;
const MULTIPLIER_RE =
  /\b\d+x\b|\b\d+\s*x\b|\b(x\d+)\b|\b(times|x)\s+(faster|better|more|higher|greater)\b/i;
const COMPARATIVE_RE =
  /\b(better than|worse than|more than|less than|faster than|slower than|higher than|lower than)\b/i;
const TESTIMONIAL_RE = /\b(I|my|we|our)\b.*\b(use|love|recommend|trust)\b/i;
const DIGIT_RE = /\d/;

/**
 * Classify a single line of text into one or more claim kinds.
 */
export function classifyClaimsInText(text: string): ClaimKind[] {
  const kinds: ClaimKind[] = [];
  const t = String(text || "");

  if (!t.trim()) return kinds;

  if (SUPERLATIVE_RE.test(t)) kinds.push("superlative");
  if (PERCENT_RE.test(t)) kinds.push("percent");
  if (MULTIPLIER_RE.test(t)) kinds.push("multiplier");
  if (COMPARATIVE_RE.test(t)) kinds.push("comparative");
  if (TESTIMONIAL_RE.test(t)) kinds.push("testimonial");

  // "factual" as a soft catch-all for numeric statements that aren't already covered
  if (DIGIT_RE.test(t) && kinds.length === 0) {
    kinds.push("factual");
  }

  return kinds;
}

/**
 * Walk an arbitrary copy object and count all claims by kind.
 * copy: usually the spec.copy object (key -> string or nested objects)
 */
export function countClaimsFromCopy(copy: any): ClaimCounts {
  const byKind: Record<ClaimKind, number> = {
    superlative: 0,
    percent: 0,
    multiplier: 0,
    comparative: 0,
    factual: 0,
    testimonial: 0,
  };

  const texts: string[] = [];

  function walk(value: any) {
    if (typeof value === "string") {
      texts.push(value);
    } else if (Array.isArray(value)) {
      for (const v of value) walk(v);
    } else if (value && typeof value === "object") {
      for (const v of Object.values(value)) walk(v);
    }
  }

  walk(copy);

  for (const txt of texts) {
    const kinds = classifyClaimsInText(txt);
    for (const k of kinds) {
      byKind[k] = (byKind[k] || 0) + 1;
    }
  }

  const total = Object.values(byKind).reduce((sum, n) => sum + (n || 0), 0);
  return { total, byKind };
}

/**
 * Estimate evidence coverage for the page.
 * - If totalClaims === 0 → treat as 1.0 (nothing to prove).
 * - If proof.fact_counts has { total_claims, with_evidence } → use that ratio.
 * - Otherwise, if there *are* claims but no proof → 0.
 */
export function estimateEvidenceCoverage(
  proof: any,
  totalClaims: number
): number {
  if (!totalClaims) return 1;

  if (proof && typeof proof === "object") {
    const factCounts = (proof as any).fact_counts;
    if (
      factCounts &&
      typeof factCounts.total_claims === "number" &&
      typeof factCounts.with_evidence === "number"
    ) {
      const tc = Math.max(1, factCounts.total_claims);
      const we = Math.max(0, factCounts.with_evidence);
      return Math.max(0, Math.min(1, we / tc));
    }
  }

  // Claims exist but we have no structured proof counts → 0 coverage.
  return 0;
}
