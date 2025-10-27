// server/intent/citelock.pro.ts
import { searchEvidence, entails } from "./evidence.ts";

type ProofStatus = "evidenced" | "redacted" | "unknown";
type ProofRow = { field: string; claim: string; status: ProofStatus; score?: number; source?: {url?:string; title?:string}; snippet?: string; reason?: string };
type ProofMap = Record<string, ProofRow>;

const CRITICAL_FIELDS = ["HEADLINE","HERO_SUBHEAD","TAGLINE"];
const FACTY_PREFIXES = ["STAT_", "FACT_", "PROOF_", "NUM_", "METRIC_"];

function looksFactual(s: any){
  if (typeof s !== "string") return false;
  if (CRITICAL_FIELDS.some(f=>s.includes(f))) return true;
  // heuristic: numbers / % / x multipliers / superlatives
  return /\b\d|%|x\b/i.test(s) || /\b(best|leading|largest|#1|top)\b/i.test(s);
}

function soften(s: string){
  return s
    .replace(/\s*\(ref:\s*[^)]+\)\s*$/i, "")
    .replace(/\b(#1|No\.?\s?1|top|best|leading|largest)\b/gi, "trusted")
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(%|percent)\b/gi, "many")
    .replace(/\b\d+(?:\.\d+)?\s*x\b/gi, "multi-fold");
}

function isFactKey(k: string){
  return CRITICAL_FIELDS.includes(k) || FACTY_PREFIXES.some(p=> k.startsWith(p));
}

export function buildProof(copy: Record<string, any>){
  const proof: ProofMap = {};
  const copyPatch: Record<string, string> = {};

  for (const [k, v] of Object.entries(copy || {})) {
    if (!isFactKey(k) && !looksFactual(v)) continue;
    const claim = String(v || "").trim();
    if (!claim) continue;

    const hits = searchEvidence(claim, 5);
    const top = hits[0];

    if (top) {
      const ent = entails(claim, top.text);
      if (ent.ok) {
        // keep claim; add small proof strip (non-breaking)
        const ref = top.source?.title ? top.source.title : (top.source?.url || "source");
        copyPatch[k] = `${claim.replace(/\s*\(ref:\s*[^)]+\)\s*$/i,"")} (ref: ${ref})`;
        proof[k] = { field: k, claim, status: "evidenced", score: ent.score, source: top.source, snippet: top.text, reason: ent.reason };
        continue;
      }
    }

    // Not entailed → redact/soften, mark status
    const softened = soften(claim);
    if (softened !== claim) copyPatch[k] = softened;
    proof[k] = { field: k, claim, status: hits.length ? "redacted" : "unknown", score: hits[0]?.score, source: hits[0]?.source, snippet: hits[0]?.text, reason: hits.length ? "not_entailed" : "no_evidence" };
  }

  return { copyPatch, proof };
}
