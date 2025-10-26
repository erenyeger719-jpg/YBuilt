// server/intent/retrieval.ts
import fs from 'fs';
import path from 'path';

const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBED = process.env.LOCAL_EMBED || 'nomic-embed-text'; // or "bge-small-en-v1.5"
const DB_FILE = path.resolve('.cache', 'retrieval.jsonl');

type Doc = {
  id: string;
  prompt: string;
  sections: string[];
  copy?: Record<string,string>;
  brand?: any;
  vec?: number[];
};

function ensureDir() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '');
}

function tokenize(t: string) {
  return (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter(Boolean);
}

function cos(a: number[], b: number[]) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}

async function embed(text: string): Promise<number[]|null> {
  try {
    const r = await fetch(`${OLLAMA}/api/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: EMBED, prompt: text }),
    });
    if (!r.ok) return null;
    const d: any = await r.json();
    const v = Array.isArray(d?.embedding) ? d.embedding : null;
    return v && v.every((x: any) => typeof x === 'number') ? v : null;
  } catch { return null; }
}

function jaccard(a: string[], b: string[]) {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...a, ...b]).size || 1;
  return inter / union;
}

function readAll(): Doc[] {
  ensureDir();
  const lines = fs.readFileSync(DB_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l) as Doc; } catch { return null as any; } }).filter(Boolean);
}

function append(d: Doc) {
  ensureDir();
  fs.appendFileSync(DB_FILE, JSON.stringify(d) + '\n', 'utf8');
}

export async function addExample(sessionId: string, prompt: string, data: { sections: string[]; copy?: Record<string,string>; brand?: any }) {
  const vec = await embed(prompt);
  const doc: Doc = { id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`, prompt, sections: data.sections || [], copy: data.copy || {}, brand: data.brand || {}, vec: vec || undefined };
  append(doc);
}

export async function nearest(prompt: string): Promise<Doc|null> {
  const all = readAll();
  if (!all.length) return null;

  const v = await embed(prompt);
  if (v) {
    let best: Doc|null = null, score = 0;
    for (const d of all) {
      if (!Array.isArray(d.vec)) continue;
      const s = cos(v, d.vec as number[]);
      if (s > score) { score = s; best = d; }
    }
    return score >= 0.82 ? best : null;
  }

  // Fallback: token overlap (works without embeddings)
  const toks = tokenize(prompt);
  let best: Doc|null = null, score = 0;
  for (const d of all) {
    const s = jaccard(toks, tokenize(d.prompt));
    if (s > score) { score = s; best = d; }
  }
  return score >= 0.35 ? best : null;
}
