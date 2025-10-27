// server/intent/citelock.pro.ts
import fs from "fs";
import path from "path";

export function sanitizeFacts(copy: Record<string, string> = {}) {
  const flags: string[] = [];
  const patch: Record<string, string> = {};

  const sus =
    /\b(#1|No\.?\s?1|top|best|leading|largest)\b|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:%|percent|x|k|m|b)\b|\b(since|est\.?)\s*20\d{2}\b/i;
  const hasSource = (s: string) =>
    /\bhttps?:\/\/|source:|ref:|footnote|data:/i.test(s);

  for (const [k, v] of Object.entries(copy)) {
    if (typeof v !== "string") continue;
    if (sus.test(v) && !hasSource(v)) {
      flags.push(k);
      const nv = v
        .replace(/\b(#1|No\.?\s?1|top|best|leading|largest)\b/gi, "trusted")
        .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(%|percent)\b/gi, "many")
        .replace(/\b\d+(?:\.\d+)?\s*x\b/gi, "multi-fold")
        .replace(/\b(since|est\.?)\s*20\d{2}\b/gi, "for years");
      patch[k] = nv;
    }
  }
  return { copyPatch: patch, flags };
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
