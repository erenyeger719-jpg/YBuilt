// server/qa/locale.layout.policy.ts

export type ScriptKind = "latin" | "cjk" | "rtl";

export interface LocaleLayoutPolicy {
  script: ScriptKind;
  /**
   * Recommended max line length in "ch" (rough characters per line)
   * for comfortable reading.
   */
  maxLineLengthCh: number;
  /**
   * Target reading grade level, when relevant for the script.
   * Not all scripts care (e.g. CJK can leave this undefined).
   */
  targetGradeLevel?: number;
  /**
   * Whether automatic hyphenation is allowed.
   */
  allowHyphenation: boolean;
  /**
   * Punctuation spacing rules to keep typography sane.
   */
  punctuationSpacing: "latin" | "cjk" | "rtl";
}

/**
 * Very small heuristic:
 * - en, fr, de, es, pt, etc. → latin
 * - ja, zh, ko → cjk
 * - ar, he, fa, ur → rtl
 * Everything else: default to latin.
 */
export function inferScriptFromLocale(locale?: string | null): ScriptKind {
  if (!locale) return "latin";

  const raw = String(locale).toLowerCase().trim();
  if (!raw) return "latin";

  // Strip region, e.g. "en-US" -> "en"
  const base = raw.split(/[-_]/)[0];

  if (["ja", "zh", "ko"].includes(base)) {
    return "cjk";
  }

  if (["ar", "he", "fa", "ur"].includes(base)) {
    return "rtl";
  }

  return "latin";
}

/**
 * Return layout policy tuned for the locale's script.
 * This does not enforce anything, it just centralizes the defaults.
 */
export function getLocaleLayoutPolicy(locale?: string | null): LocaleLayoutPolicy {
  const script = inferScriptFromLocale(locale);

  if (script === "cjk") {
    return {
      script,
      maxLineLengthCh: 40, // CJK can feel dense; keep it shorter
      // grade level is less meaningful in the same way, leave undefined
      allowHyphenation: false,
      punctuationSpacing: "cjk",
    };
  }

  if (script === "rtl") {
    return {
      script,
      maxLineLengthCh: 60,
      targetGradeLevel: 8,
      allowHyphenation: false,
      punctuationSpacing: "rtl",
    };
  }

  // default: latin
  return {
    script: "latin",
    maxLineLengthCh: 80,
    targetGradeLevel: 8,
    allowHyphenation: true,
    punctuationSpacing: "latin",
  };
}
