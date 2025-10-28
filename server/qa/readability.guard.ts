// server/qa/readability.guard.ts
// Deterministic readability scan + gentle auto-patch.
// Non-destructive: returns copyPatch you can Object.assign into copy.

export type ReadabilityResult = {
  score: number;                    // 0..100 (higher is better)
  issues: string[];                 // human-readable notes
  copyPatch: Record<string, string>;// suggested safe fixes
};

type Copy = Record<string, unknown>;

// keys most users will see first — keep them extra tidy
const CRITICAL_KEYS = new Set([
  "HEADLINE",
  "HERO_SUBHEAD",
  "TAGLINE",
  "CTA_HEAD",
  "CTA_LABEL",
  "FEATURE_1_HEAD",
  "FEATURE_2_HEAD",
  "FEATURE_3_HEAD",
]);

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

// naive word count
function wc(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function sentenceSplit(s: string) {
  // keep delimiters; very tolerant
  const parts = s.split(/([.!?])\s+/).filter((x) => x !== "");
  if (parts.length <= 1) return [s];
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] || "";
    const end = parts[i + 1] || "";
    out.push((body + end).trim());
  }
  return out.filter(Boolean);
}

function tidyWhitespace(s: string) {
  return s.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function titleCaseIfShouting(s: string) {
  // if 8+ consecutive caps (likely shouting), soft-normalize case
  if (/[A-Z]{8,}/.test(s)) {
    return s
      .toLowerCase()
      .replace(/(^|\.\s+)([a-z])/g, (_m, p, a) => p + a.toUpperCase());
  }
  return s;
}

function endWithPunctIfLong(s: string) {
  if (s.length <= 40) return s;
  if (/[.!?]\s*$/.test(s)) return s;
  return s + ".";
}

function breakOverlongSentence(s: string) {
  // if one mega-sentence without punctuation, insert a soft break around 20th word
  if (/[.!?]/.test(s)) return s;
  const words = s.trim().split(/\s+/);
  if (words.length <= 28) return s;
  const i = Math.min(20, Math.max(8, Math.floor(words.length * 0.4)));
  words.splice(i, 0, ".");
  let out = words.join(" ");
  // normalize “ . ” -> “.”
  out = out.replace(/\s*\.\s*/g, ". ");
  return out.trim();
}

export function checkCopyReadability(copy: Copy): ReadabilityResult {
  const issues: string[] = [];
  const patch: Record<string, string> = {};

  let totalKeys = 0;
  let penalty = 0;

  for (const [k, v] of Object.entries(copy)) {
    if (typeof v !== "string") continue;
    totalKeys++;

    const original = v;
    let s = v;

    // normalize whitespace, reduce screaming, cap punctuation spam
    s = tidyWhitespace(s);
    s = titleCaseIfShouting(s);
    s = s.replace(/[!?]{3,}/g, "!!");

    // break overlong run-ons
    const parts = sentenceSplit(s);
    const longParts = parts.filter((p) => wc(p) > 28);
    if (!/[.!?]/.test(s) && wc(s) > 28) s = breakOverlongSentence(s);

    // gentle ending punctuation for long critical strings
    if (CRITICAL_KEYS.has(k)) s = endWithPunctIfLong(s);

    // capitalise sentence starts
    s = s.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p, a) => p + a.toUpperCase());

    // scoring heuristics
    const words = wc(s);
    const chars = s.length;
    const hasPunct = /[.!?]/.test(s);
    if (chars > 180) { penalty += 2; issues.push(`${k}: too long (${chars} chars)`); }
    if (words > 35)  { penalty += 1; issues.push(`${k}: too many words (${words})`); }
    if (!hasPunct && words > 18) { penalty += 1; issues.push(`${k}: add sentence break/punctuation`); }
    if (/[A-Z]{8,}/.test(original)) { penalty += 1; issues.push(`${k}: excessive ALL CAPS`); }
    if (longParts.length) { penalty += 1; issues.push(`${k}: break long sentence(s)`); }

    if (s !== original) patch[k] = s;
  }

  const base = 100;
  const denom = Math.max(1, totalKeys);
  // each penalty point costs ~7, scaled by how many keys we inspected
  const score = clamp(Math.round(base - (penalty * 7 * (1 / Math.sqrt(denom)))));

  return { score, issues, copyPatch: patch };
}
