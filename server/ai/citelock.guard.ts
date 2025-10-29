// server/ai/citelock.guard.ts
// CiteLock-Pro (final gate): score grounding and return allow/soften/block.
// Zero deps. Pure functions. Wire into your generation path right before send.

type Citation = { url: string; title?: string };
type Mode = "strict" | "balanced" | "lenient";

export type CiteVerdict = {
  ok: boolean;                 // true = allow
  action: "allow" | "soften" | "block";
  score: number;               // 0..100 grounding score
  reasons: string[];
  safeText?: string;           // softened/redacted output (if action != allow)
};

const NEEDS_CITES_DOMAINS = new Set(["medical","health","legal","finance","news","factual","science","history"]);

const URL_RE = /\bhttps?:\/\/[^\s)]+/gi;
const BRACKET_CITE_RE = /\[\d+\]/g;
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+/g;

// naive “claimy” signal: numbers, years, %, “according to”, “report”, “study”, “since”, “as of”
const CLAIM_SIGNALS: RegExp[] = [
  /\b\d{4}\b/g, /\b\d+(\.\d+)?%/g, /\b\d+(\.\d+)?\b/g,
  /\baccording to\b/i, /\breport(ed|s)?\b/i, /\bstudy(ing|ies|)\b/i,
  /\bsince\b/i, /\bas of\b/i, /\bdata\b/i
];

// classify whether text likely *needs* cites
function needsCitations(text: string, domainHint?: string): { needs: boolean; signals: number } {
  const sentences = text.split(SENTENCE_SPLIT_RE).filter(Boolean);
  const signalHits = CLAIM_SIGNALS.reduce((acc, re) => acc + (text.match(re)?.length || 0), 0);
  const domainNeeds = domainHint && NEEDS_CITES_DOMAINS.has(domainHint.toLowerCase());

  // heuristic: “claim density” or sensitive domain -> needs citations
  const claimDensity = signalHits / Math.max(1, sentences.length);
  const needs = domainNeeds || claimDensity >= 0.6 || (claimDensity >= 0.3 && sentences.length >= 4);

  return { needs, signals: signalHits };
}

function normalizeCitations(citations?: Citation[]): string[] {
  const urls = new Set<string>();
  for (const c of citations || []) {
    const u = (c?.url || "").trim();
    if (/^https?:\/\//i.test(u)) urls.add(u);
  }
  return Array.from(urls);
}

function countInlineMarks(text: string): number {
  return (text.match(BRACKET_CITE_RE)?.length || 0) + (text.match(URL_RE)?.length || 0);
}

// crude domain trust score: prefer .gov/.edu, penalize url shorteners
function trustOf(url: string): number {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h.endsWith(".gov")) return 1.0;
    if (h.endsWith(".edu") || h.endsWith(".ac.in")) return 0.95;
    if (/\b(wikipedia|nih|who|un\.)/.test(h)) return 0.9;
    if (/\b(medium|substack|blogspot|wordpress)\b/.test(h)) return 0.6;
    if (/\b(tinyurl|bit\.ly|t\.co)\b/.test(h)) return 0.5;
    return 0.8;
  } catch { return 0.5; }
}

function coverageScore(text: string, cites: string[]): number {
  const sentences = text.split(SENTENCE_SPLIT_RE).filter(Boolean);
  if (!sentences.length) return 0;
  // weight: inline marks and presence of any cite
  const inline = Math.min(1, countInlineMarks(text) / Math.max(1, sentences.length / 3));
  const hasAny = cites.length > 0 ? 0.25 : 0;
  const trust = cites.length ? cites.map(trustOf).reduce((a,b)=>a+b,0) / cites.length : 0;
  // 0..1
  return Math.max(0, Math.min(1, 0.5 * inline + hasAny + 0.25 * trust));
}

function soften(text: string, cites: string[]): string {
  const lead = "This content may include unverified claims. Treat as opinion unless a source is provided.\n\n";
  const tail = cites.length ? `\n\nSources:\n${cites.map(u => `- ${u}`).join("\n")}` : "";
  return lead + text + tail;
}

export function citeLockGuard(input: {
  text: string;
  domainHint?: string;         // e.g., "news", "medical"
  citations?: Citation[];      // URLs you already gathered
  mode?: Mode;                 // default balanced
}): CiteVerdict {
  const mode: Mode = input.mode || "balanced";
  const text = (input.text || "").trim();

  if (!text) return { ok: false, action: "block", score: 0, reasons: ["empty_text"] };

  const cites = normalizeCitations(input.citations);
  const need = needsCitations(text, input.domainHint);

  const cov = coverageScore(text, cites);    // 0..1
  const claiminess = Math.min(1, need.signals / 12); // saturate

  // composite score: more “claimy” text demands more coverage
  const score = Math.round(100 * Math.max(0, cov - 0.3 * claiminess + 0.1 * (cites.length ? 1 : 0)));

  const reasons: string[] = [];
  if (need.needs) reasons.push("claims_detected_or_sensitive_domain");
  if (!cites.length && need.needs) reasons.push("no_citations_present");
  if (cov < 0.5 && need.needs) reasons.push("insufficient_inline_or_trust");

  // thresholds per mode
  const THRESH = {
    strict:  { allow: 75, soften: 55 },
    balanced:{ allow: 65, soften: 45 },
    lenient: { allow: 55, soften: 35 },
  }[mode];

  let action: CiteVerdict["action"] = "allow";
  if (score < THRESH.soften && need.needs) action = "block";
  else if (score < THRESH.allow && need.needs) action = "soften";

  const verdict: CiteVerdict = {
    ok: action === "allow",
    action,
    score,
    reasons
  };

  if (action !== "allow") {
    verdict.safeText = soften(text, cites);
  }

  return verdict;
}
