// server/qa/edit.search.ts
import { checkCopyReadability } from "./readability.guard.ts";

type Spec = { brand?: { tone?: string; dark?: boolean }; layout?: { sections?: string[] } };
type EditSearchIn = { spec: Spec; copy: Record<string, string> };
type EditSearchOut = { better: boolean; spec: Spec; applied: string[] };

type Action = { name: string; apply: (s: Spec, c: Record<string, string>) => { spec: Spec; copy: Record<string, string> } };

// --- helpers ---
function deepClone<T>(x: T): T { return JSON.parse(JSON.stringify(x || null)); }

function score(copy: Record<string, string>, spec: Spec) {
  const r = safeReadability(copy);
  const base = r.score; // 0..100

  const hasCTA = !!(copy.CTA_LABEL && copy.CTA_HEAD);
  const ctaBonus = hasCTA ? 4 : 0;

  // If readability is low, reward minimal tone & light mode a bit
  const needSofter = r.score < 60;
  const toneBonus = needSofter && spec.brand?.tone === "minimal" ? 4 : 0;
  const lightBonus = needSofter && spec.brand?.dark === false ? 3 : 0;

  // Very light penalty for overly long headline
  const h = String(copy.HEADLINE || "");
  const lenPenalty = h.length > 90 ? Math.min(8, Math.floor((h.length - 90) / 10)) : 0;

  return base + ctaBonus + toneBonus + lightBonus - lenPenalty;
}

function safeReadability(copy: Record<string, string>): { score: number } {
  try { const r = checkCopyReadability(copy); return { score: r?.score ?? 100 }; }
  catch { return { score: 100 }; }
}

// deterministic, safe edits
const ACTIONS: Action[] = [
  {
    name: "More minimal",
    apply: (s, c) => {
      const spec = deepClone(s);
      spec.brand = { ...(spec.brand || {}), tone: "minimal" };
      return { spec, copy: { ...c } };
    }
  },
  {
    name: "Switch to light",
    apply: (s, c) => {
      const spec = deepClone(s);
      spec.brand = { ...(spec.brand || {}), dark: false };
      return { spec, copy: { ...c } };
    }
  },
  {
    name: "Use email signup CTA",
    apply: (s, c) => {
      const copy = { ...c };
      if (!copy.CTA_LABEL) copy.CTA_LABEL = "Get started";
      if (!copy.CTA_HEAD) copy.CTA_HEAD = "Ready when you are";
      return { spec: deepClone(s), copy };
    }
  },
  {
    name: "Remove dense features",
    apply: (s, c) => {
      const spec = deepClone(s);
      const arr = new Set((spec.layout?.sections || []).map(String));
      if (arr.has("features-3col")) { arr.delete("features-3col"); }
      spec.layout = { sections: Array.from(arr) };
      return { spec, copy: { ...c } };
    }
  },
];

export async function editSearch(input: EditSearchIn): Promise<EditSearchOut> {
  const startSpec = deepClone(input.spec || {});
  startSpec.brand = { ...(startSpec.brand || {}) };
  startSpec.layout = { sections: [...(startSpec.layout?.sections || [])] };
  const startCopy = { ...(input.copy || {}) };

  const baseScore = score(startCopy, startSpec);
  type Node = { spec: Spec; copy: Record<string, string>; actions: string[]; s: number };
  let best: Node = { spec: startSpec, copy: startCopy, actions: [], s: baseScore };

  // Beam (width=4), depth=2
  let frontier: Node[] = [best];
  for (let depth = 0; depth < 2; depth++) {
    const next: Node[] = [];
    for (const node of frontier) {
      for (const act of ACTIONS) {
        const { spec, copy } = act.apply(node.spec, node.copy);
        const s = score(copy, spec);
        next.push({ spec, copy, actions: [...node.actions, act.name], s });
      }
    }
    // pick top-4 to expand
    next.sort((a, b) => b.s - a.s);
    frontier = next.slice(0, 4);
    if (frontier[0].s > best.s) best = frontier[0];
  }

  const improved = best.s > baseScore + 1; // require a tiny real gain
  return { better: improved, spec: improved ? best.spec : startSpec, applied: improved ? best.actions : [] };
}
// ----- failure-aware search core -----

export type EditAttempt = {
  // which fix we tried (if any) for this attempt
  fixId: string | null;
  // whether that attempt passed all checks
  success: boolean;
  // optional high-level reason for failure, e.g. "a11y", "perf", "claims"
  reason?: string | null;
};

export type EditCandidate = {
  id: string;
  // tags describing what this fix is good at, e.g. ["a11y", "layout"]
  tags?: string[];
  // lower = safer / preferred
  risk?: number;
};

export type FailureAwareDecision = {
  // next fix to try; null if we should stop and escalate
  next: EditCandidate | null;
  // true means "don't keep guessing, hand off to fallback"
  stop: boolean;
};

/**
 * Simple failure-aware search:
 * - If we already have >= maxAttempts failed tries → stop.
 * - Otherwise pick an untried fix:
 *    - Prefer ones tagged for the last failure reason.
 *    - Among those, pick the lowest-risk.
 *    - If none are tagged, pick lowest-risk overall.
 */
export function failureAwareSearch(
  attempts: EditAttempt[],
  fixes: EditCandidate[],
  maxAttempts: number = 3
): FailureAwareDecision {
  const failures = attempts.filter((a) => !a.success);

  // Too many failures → stop trying to generate, caller should fallback.
  if (failures.length >= maxAttempts) {
    return { next: null, stop: true };
  }

  // Track which fixes we've already tried.
  const tried = new Set<string>();
  for (const a of attempts) {
    if (a.fixId) tried.add(a.fixId);
  }

  // Only consider fixes we haven't tried yet.
  const untried = fixes.filter((f) => !tried.has(f.id));
  if (untried.length === 0) {
    // Nothing left to try.
    return { next: null, stop: true };
  }

  const lastFail = failures[failures.length - 1];
  const lastReason = (lastFail?.reason || "").toLowerCase().trim();

  const tagged: EditCandidate[] = [];
  const others: EditCandidate[] = [];

  for (const f of untried) {
    const tags = (f.tags || []).map((t) => t.toLowerCase());
    if (lastReason && tags.includes(lastReason)) {
      tagged.push(f);
    } else {
      others.push(f);
    }
  }

  // Prefer fixes that explicitly target the last failure reason.
  const pool = tagged.length > 0 ? tagged : others;

  // Within the chosen pool, prefer lowest-risk fix.
  const sorted = [...pool].sort(
    (a, b) => (a.risk ?? 0) - (b.risk ?? 0)
  );

  const next = sorted[0] || null;
  if (!next) {
    return { next: null, stop: true };
  }

  return { next, stop: false };
}
