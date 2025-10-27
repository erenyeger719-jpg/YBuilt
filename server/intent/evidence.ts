// server/intent/evidence.ts
import fs from "fs";
import crypto from "crypto";

const DIR = ".cache/evidence";
const FILE_DOCS = `${DIR}/docs.json`;   // { [id]: { id, url?, title?, text, addedTs } }
const FILE_IDX  = `${DIR}/index.json`;  // { paragraphs: Array<{id, docId, text, tokens:Record<string,number>}>, idf:Record<string,number>, vocabSize:number }

type Doc = { id: string; url?: string; title?: string; text: string; addedTs: number };
type Para = { id: string; docId: string; text: string; tokens: Record<string, number> };

function ensure() { fs.mkdirSync(DIR, { recursive: true }); }
function readJSON<T>(p: string, def: T): T { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return def; } }
function writeJSON(p: string, v: any){ ensure(); fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

const STOP = new Set(["the","a","an","and","or","but","of","to","in","on","for","with","as","by","at","from","is","are","was","were","be","been","it","this","that","these","those","we","you","our","your","their"]);

function toks(s: string){
  return String(s).toLowerCase()
    .replace(/[^a-z0-9%.\- ]+/g," ")
    .split(/\s+/).filter(Boolean)
    .filter(w=>!STOP.has(w) && w.length>1);
}

function paraSplit(text: string){
  const raw = String(text||"").split(/\n{2,}|\r?\n-\s|\.\s+(?=[A-Z(])/g);
  return raw.map(t=>t.trim()).filter(Boolean).slice(0, 400); // cap
}

function hash(s:string){ return crypto.createHash("sha1").update(s).digest("hex"); }

export function addEvidence({ id, url, title, text }:{ id?:string; url?:string; title?:string; text:string }){
  ensure();
  const docs = readJSON<Record<string,Doc>>(FILE_DOCS, {});
  const docId = id || hash(String(url||title||text).slice(0,512));
  docs[docId] = { id: docId, url, title, text, addedTs: Date.now() };
  writeJSON(FILE_DOCS, docs);
  return { ok:true, id: docId };
}

export function rebuildEvidenceIndex(){
  ensure();
  const docs = readJSON<Record<string,Doc>>(FILE_DOCS, {});
  const paragraphs: Para[] = [];
  const df = new Map<string, number>();

  for (const d of Object.values(docs)) {
    for (const p of paraSplit(d.text)) {
      const id = hash(d.id + "::" + p.slice(0,120));
      const counts: Record<string, number> = {};
      for (const w of toks(p)) counts[w] = (counts[w]||0)+1;
      paragraphs.push({ id, docId: d.id, text: p, tokens: counts });
      // doc-frequency per term (paragraph-level heuristic)
      const seen = new Set(Object.keys(counts));
      for (const w of seen) df.set(w, (df.get(w)||0)+1);
    }
  }

  const N = Math.max(1, paragraphs.length);
  const idf: Record<string, number> = {};
  for (const [w, n] of df.entries()) idf[w] = Math.log((N+1)/(n+0.5));

  writeJSON(FILE_IDX, { paragraphs, idf, vocabSize: df.size });
  return { ok:true, paragraphs: paragraphs.length, vocab: df.size };
}

function tfidfScore(query: string, para: Para, idf: Record<string,number>){
  const q = toks(query);
  if (!q.length) return 0;
  let s = 0;
  for (const w of q) {
    const tf = para.tokens[w] || 0;
    const idfw = idf[w] || 0;
    s += tf * idfw;
  }
  return s / Math.sqrt(1 + Object.keys(para.tokens).length);
}

export function searchEvidence(query: string, k = 5){
  const idx = readJSON<any>(FILE_IDX, { paragraphs: [], idf: {}, vocabSize: 0 });
  const scored = idx.paragraphs.map((p:Para)=>({ p, score: tfidfScore(query, p, idx.idf) }))
    .filter(x=>x.score>0)
    .sort((a,b)=> b.score - a.score)
    .slice(0, k)
    .map(x=>({
      docId: x.p.docId,
      paraId: x.p.id,
      text: x.p.text,
      score: Number(x.score.toFixed(4))
    }));
  const docs = readJSON<Record<string,Doc>>(FILE_DOCS, {});
  return scored.map(m=>({ ...m, source: { url: docs[m.docId]?.url, title: docs[m.docId]?.title } }));
}

// Very-simple lexical entailment: numbers + named tokens + negation sniff
export function entails(claim: string, evidence: string){
  const c = String(claim||"");
  const e = String(evidence||"");
  // number tokens must appear (if present)
  const nums = c.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g) || [];
  const missingNum = nums.some(n=> !e.includes(n));
  if (nums.length && missingNum) return { ok:false, score: 0.1, reason: "number_mismatch" };

  // rough named token overlap
  const cn = new Set(toks(c).filter(w=>w.length>2));
  const en = new Set(toks(e).filter(w=>w.length>2));
  let inter = 0;
  for (const w of cn) if (en.has(w)) inter++;
  const overlap = inter / Math.max(1, cn.size);

  // negation sniff
  const negClaim = /\b(no|not|never|without|none)\b/i.test(c);
  const negEv    = /\b(no|not|never|without|none)\b/i.test(e);
  const negOk = (!negClaim && !negEv) || (negClaim && negEv);

  const score = (overlap * 0.8) + (negOk ? 0.2 : 0);
  return { ok: score >= 0.55, score: Number(score.toFixed(3)), reason: negOk ? "overlap" : "negation_mismatch" };
}
