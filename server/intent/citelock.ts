// server/intent/citelock.pro.ts
import fs from "fs";
import path from "path";
import { sanitize } from "../ai/citelock.patch.ts";

export function sanitizeFacts(
  copy: Record<string, unknown>
): { copyPatch: Record<string, string>; flags: string[] } {
  // Normalize everything to strings for the sanitizer
  const src: Record<string, string> = {};
  for (const [k, v] of Object.entries(copy || {})) {
    src[k] = String(v ?? "");
  }

  // Run through the aggressive sanitizer used by tests
  const { out, flags } = sanitize(src);

  // Build a patch object: only include fields that actually changed
  const copyPatch: Record<string, string> = {};
  for (const [k, v] of Object.entries(out)) {
    if (src[k] !== v) {
      copyPatch[k] = v;
    }
  }

  return { copyPatch, flags };
}

// -------------------------------
// Tiny cached corpus loader (10s TTL)
// -------------------------------
export type CorpusDoc = { file: string; text: string };

let _corpusCache: CorpusDoc[] | null = null;
let _lastLoad = 0;

/**
 * Load small reference docs from `.data/refs` with a short in-process cache.
 * Scans *.md, *.txt, *.json and truncates each file to 100k chars for safety.
 */
export function loadCorpus(dir = ".data/refs"): CorpusDoc[] {
  const now = Date.now();
  if (_corpusCache && now - _lastLoad < 10_000) return _corpusCache; // 10s TTL

  const docs: CorpusDoc[] = [];
  try {
    if (!fs.existsSync(dir)) {
      _corpusCache = docs;
      _lastLoad = now;
      return docs;
    }
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(md|txt|json)$/i.test(f)) continue;
      const p = path.join(dir, f);
      try {
        const text = fs.readFileSync(p, "utf8").slice(0, 100_000);
        docs.push({ file: p, text });
      } catch {
        // ignore unreadable files
      }
    }
  } catch {
    // swallow directory read errors and return whatever we have
  }

  _corpusCache = docs;
  _lastLoad = now;
  return docs;
}

// -------------------------------
// Build simple “proof” annotations for potentially risky claims
// -------------------------------
type Proof = Record<
  string,
  { status: "ok" | "evidenced" | "redacted"; ref?: string }
>;

const SUS =
  /\b(#1|No\.?\s?1|top|best|leading|largest)\b|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:%|percent|x|k|m|b)\b|\b(since|est\.?)\s*20\d{2}\b/i;

function tokenize(s: string) {
  return String(s).toLowerCase().match(/[a-z0-9.%]+/g) || [];
}

function scoreOverlap(qTokens: string[], doc: { file: string; text: string }) {
  const set = new Set(tokenize(doc.text));
  let hits = 0;
  for (const t of qTokens) if (set.has(t)) hits++;
  return hits;
}

export function buildProof(copy: Record<string, string> = {}) {
  const corpus = loadCorpus(); // uses the 10s TTL cache
  const proof: Proof = {};
  const patch: Record<string, string> = {};

  for (const [k, v] of Object.entries(copy)) {
    if (typeof v !== "string") continue;
    if (!SUS.test(v)) {
      proof[k] = { status: "ok" };
      continue;
    }

    let best: { file: string; score: number } | null = null;
    const q = tokenize(v).filter((t) => t.length > 2);
    for (const d of corpus) {
      const s = scoreOverlap(q, d);
      if (s > (best?.score || 0)) best = { file: d.file, score: s };
    }

    if (best && best.score >= 4) {
      const base = path.basename(best.file);
      const ref = `ref:${base}`;
      proof[k] = { status: "evidenced", ref };
      patch[k] = `${v} (ref: ${base})`;
    } else {
      proof[k] = { status: "redacted" };
    }
  }
  return { proof, copyPatch: patch };
}

// -------------------------------
// Policy Core v2: Risk vector + gate
// -------------------------------

export type RiskVector = {
  copy_claims: "low" | "medium" | "high";
  evidenceCoverage: number; // 0..1
  totalClaims: number;
  evidencedClaims: number;
  redactedClaims: number;
};

export type GateMode = "off" | "on" | "strict";
export type GateDecision = "allow" | "soften" | "block";

/**
 * Compute a simple risk vector from the proof map.
 * - copy_claims: low/medium/high based on how many suspicious lines + how much is evidenced.
 * - evidenceCoverage: fraction of claimy fields that have evidence.
 */
export function computeRiskVector(
  copy: Record<string, string> = {},
  proof: Proof
): RiskVector {
  let totalClaims = 0;
  let evidencedClaims = 0;
  let redactedClaims = 0;

  for (const info of Object.values(proof)) {
    if (!info) continue;
    if (info.status === "ok") continue;
    totalClaims++;
    if (info.status === "evidenced") evidencedClaims++;
    if (info.status === "redacted") redactedClaims++;
  }

  const evidenceCoverage = totalClaims === 0 ? 1 : evidencedClaims / totalClaims;

  let copy_claims: RiskVector["copy_claims"];
  if (totalClaims === 0) {
    copy_claims = "low";
  } else if (evidenceCoverage >= 0.8 && redactedClaims === 0) {
    copy_claims = "medium";
  } else {
    copy_claims = "high";
  }

  return {
    copy_claims,
    evidenceCoverage,
    totalClaims,
    evidencedClaims,
    redactedClaims,
  };
}

/**
 * Turn a risk vector + mode into an explicit gate decision.
 *
 * - mode "off": always allow
 * - mode "on": soften very risky + poorly evidenced pages
 * - mode "strict": block high-risk with low evidence; soften medium-risk with very low evidence
 */
export function decideCopyGate(
  risk: RiskVector,
  mode: GateMode
): GateDecision {
  if (mode === "off") return "allow";

  if (mode === "on") {
    if (risk.copy_claims === "high" && risk.evidenceCoverage < 0.5) {
      return "soften";
    }
    return "allow";
  }

  // strict
  if (risk.copy_claims === "high" && risk.evidenceCoverage < 0.8) {
    return "block";
  }
  if (risk.copy_claims === "medium" && risk.evidenceCoverage < 0.5) {
    return "soften";
  }
  return "allow";
}
