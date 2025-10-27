// server/intent/citelock.pro.ts
import fs from "fs";
import path from "path";

type Proof = Record<string, { status: "ok" | "evidenced" | "redacted"; ref?: string }>;

const SUS = /\b(#1|No\.?\s?1|top|best|leading|largest)\b|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:%|percent|x|k|m|b)\b|\b(since|est\.?)\s*20\d{2}\b/i;

function tokenize(s: string) { return String(s).toLowerCase().match(/[a-z0-9.%]+/g) || []; }

function loadCorpus(dir = ".data/refs") {
  const docs: { file: string; text: string }[] = [];
  try {
    if (!fs.existsSync(dir)) return docs;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(md|txt|json)$/i.test(f)) continue;
      const p = path.join(dir, f);
      const text = fs.readFileSync(p, "utf8").slice(0, 100_000);
      docs.push({ file: p, text });
    }
  } catch {}
  return docs;
}

function scoreOverlap(qTokens: string[], doc: { file: string; text: string }) {
  const set = new Set(tokenize(doc.text));
  let hits = 0;
  for (const t of qTokens) if (set.has(t)) hits++;
  return hits;
}

export function buildProof(copy: Record<string, string> = {}) {
  const corpus = loadCorpus();
  const proof: Proof = {};
  const patch: Record<string, string> = {};

  for (const [k, v] of Object.entries(copy)) {
    if (typeof v !== "string") continue;
    if (!SUS.test(v)) { proof[k] = { status: "ok" }; continue; }

    let best: { file: string; score: number } | null = null;
    const q = tokenize(v).filter((t) => t.length > 2);
    for (const d of corpus) {
      const s = scoreOverlap(q, d);
      if (s > (best?.score || 0)) best = { file: d.file, score: s };
    }

    if (best && best.score >= 4) {
      const ref = `ref:${path.basename(best.file)}`;
      proof[k] = { status: "evidenced", ref };
      // Add a tiny "(ref: ...)" so sanitizeFacts will skip this line
      patch[k] = `${v} (ref: ${path.basename(best.file)})`;
    } else {
      proof[k] = { status: "redacted" };
      // Leave redaction to sanitizeFacts downstream
    }
  }
  return { proof, copyPatch: patch };
}
