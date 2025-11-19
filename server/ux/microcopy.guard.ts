// server/ux/microcopy.guard.ts
// Deterministic microcopy guard: length bands, viewport-aware ranges, simple readability.
// Emits patches + issues; can be used in UI or pre-AI rewrite step.

export type GuardOpts = {
  viewport?: "mobile" | "tablet" | "desktop";
  locale?: string;          // "en", "hi", "ja", ...
  target_grade?: number;    // rough grade target (en only), default 7-9
  enforce?: boolean;        // if true, returns trimmed "patched"
};

type Issue = {
  key: string;
  kind: "too_short" | "too_long" | "grade_high";
  limit?: { min?: number; max?: number };
  value?: number;
  action: "warn" | "trim" | "rewrite";
};

const FIELD_RANGES = {
  desktop: {
    HEADLINE: { min: 28, max: 64 },
    HERO_SUBHEAD: { min: 70, max: 140 },
    TAGLINE: { min: 20, max: 60 },
    CTA_HEAD: { min: 8,  max: 24 },
    FEATURE_1: { min: 40, max: 160 },
    FEATURE_2: { min: 40, max: 160 },
    FEATURE_3: { min: 40, max: 160 },
  },
  mobile: {
    HEADLINE: { min: 24, max: 48 },
    HERO_SUBHEAD: { min: 60, max: 120 },
    TAGLINE: { min: 18, max: 48 },
    CTA_HEAD: { min: 8,  max: 20 },
    FEATURE_1: { min: 40, max: 140 },
    FEATURE_2: { min: 40, max: 140 },
    FEATURE_3: { min: 40, max: 140 },
  },
  tablet: undefined as any, // falls back to desktop
} as const;

function isCJK(s: string) { return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(s); }
function isRTL(s: string) { return /[\u0590-\u08FF]/.test(s); }

function approxSyllables(word: string) {
  // crude syllable proxy; good enough for triage
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const m = w.replace(/(?:^e|e$)/g, "").match(/[aeiouy]+/g);
  return Math.max(1, (m?.length ?? 0));
}
function gradeEstimate(text: string) {
  const sentences = (text.match(/[.!?]+/g) || []).length || 1;
  const words = (text.trim().match(/\b[\p{L}\p{N}’']+\b/gu) || []).length || 1;
  const syllables = (text.match(/\b[\p{L}’']+\b/gu) || [])
    .reduce((acc, w) => acc + approxSyllables(String(w)), 0) || words;
  // Flesch-Kincaid Grade (approx)
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

export function guardMicrocopy(
  copy: Record<string, any>,
  opts: GuardOpts = {}
): { ok: boolean; issues: Issue[]; patched: Record<string, string>; meta: any } {
  const viewport = opts.viewport || "desktop";
  const ranges = (FIELD_RANGES as any)[viewport] || FIELD_RANGES.desktop;
  const targetGrade = Math.min(12, Math.max(5, opts.target_grade ?? 8));

  const patched: Record<string, string> = {};
  const issues: Issue[] = [];

  for (const [k, v] of Object.entries(copy || {})) {
    const s = String(v ?? "").trim();
    if (!s) continue;

    const cjk = isCJK(s);
    const rtl = isRTL(s);

    const band = (ranges as any)[k] || null;
    if (band) {
      const L = cjk ? [...s].length : s.length; // naive char count; CJK tends to be denser
      if (band.min && L < band.min) issues.push({ key: k, kind: "too_short", limit: { min: band.min }, value: L, action: "warn" });
      if (band.max && L > band.max) {
        issues.push({ key: k, kind: "too_long", limit: { max: band.max }, value: L, action: opts.enforce ? "trim" : "warn" });
      }
      // only trim when enforce=true
      patched[k] = (band.max && L > band.max && !!opts.enforce)
        ? s.slice(0, band.max).replace(/\s+\S*$/, "")
        : s;
    } else {
      patched[k] = s;
    }

    // Grade (English-ish only; skip for CJK/RTL)
    if (!cjk && !rtl && /[a-z]/i.test(s)) {
      const g = gradeEstimate(s);
      if (g > targetGrade + 1) {
        issues.push({ key: k, kind: "grade_high", value: g, action: "rewrite" });
      }
    }
  }

  return {
    ok: issues.length === 0 || issues.every(i => i.action === "warn"),
    issues,
    patched,
    meta: { viewport, targetGrade },
  };
}
