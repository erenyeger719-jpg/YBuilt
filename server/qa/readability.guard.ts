// server/qa/readability.guard.ts

type Copy = Record<string, string>;
type Check = { score: number; issues: string[] };

// Simple Coleman–Liau-ish grade (rough but deterministic)
function estGrade(text: string): number {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return 0;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  const words = Math.max(1, (t.match(/\b[\w'-]+\b/g) || []).length);
  const sentences = Math.max(1, (t.match(/[.!?]+/g) || []).length);
  const L = (letters / words) * 100;
  const S = (sentences / words) * 100;
  const grade = 0.0588 * L - 0.296 * S - 15.8;
  return Math.max(0, Math.round(grade * 10) / 10);
}

function capLen(s: string, maxChars: number, label: string, out: string[]) {
  const n = (s || "").trim().length;
  if (n > maxChars) out.push(`${label} too long (${n}/${maxChars} chars)`);
}

function capAllCaps(s: string, maxRun: number, label: string, out: string[]) {
  if (new RegExp(`[A-Z]{${maxRun},}`).test(s)) out.push(`${label} has long ALL-CAPS run`);
}

export function checkCopyReadability(copy: Copy): Check {
  const issues: string[] = [];
  // Headline rhythm & tone caps
  if (copy.HEADLINE) {
    capLen(copy.HEADLINE, 90, "HEADLINE", issues);
    capAllCaps(copy.HEADLINE, 12, "HEADLINE", issues);
  }
  if (copy.HERO_SUBHEAD) {
    capLen(copy.HERO_SUBHEAD, 160, "HERO_SUBHEAD", issues);
  }
  if (copy.TAGLINE) {
    capLen(copy.TAGLINE, 80, "TAGLINE", issues);
  }

  // Grade targets (soft): core surfaces aim ≤ 9
  const keys = ["HEADLINE", "HERO_SUBHEAD", "TAGLINE"];
  for (const k of keys) {
    const v = copy[k];
    if (!v) continue;
    const g = estGrade(v);
    if (g > 9.0) issues.push(`${k} reading grade high (${g} > 9)`);
  }

  // Score: start 100, subtract 5 per issue (cap to 0)
  const score = Math.max(0, 100 - issues.length * 5);
  return { score, issues };
}
