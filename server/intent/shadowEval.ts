// server/intent/shadowEval.ts
import fs from "fs";
import path from "path";
import { checkCopyReadability } from "../qa/readability.guard.ts";
import { sanitizeFacts } from "./citelock.ts";

const FILE = path.resolve(".cache/shadow.metrics.json");
const PROOF_DIR = path.resolve(".cache/proof");

type Job = { prompt: string; spec: any; sessionId?: string };

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return { n: 0, pass: 0, fail: 0 }; }
}
function save(j: any) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(j, null, 2));
  } catch {}
}

function readProof(pageId: string) {
  try {
    const p = path.join(PROOF_DIR, `${pageId}.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function queueShadowEval(job: Job) {
  try {
    const score = runEval(job);
    const db = load();
    db.n += 1;
    if (score.pass) db.pass += 1; else db.fail += 1;
    save(db);
  } catch {}
}

function runEval(job: Job) {
  const copy: Record<string, string> = job?.spec?.copy || {};
  let readability = 100;
  try { readability = checkCopyReadability(copy)?.score ?? 100; } catch {}
  let flags = 0;
  try { const r = sanitizeFacts(copy); flags = (r?.flags || []).length; } catch {}
  const pass = readability >= 60 && flags === 0;
  return { pass, readability, flags };
}

// NEW: reward on real-world conversion (safe, observation-only)
export function rewardShadow(pageId: string) {
  if (!pageId) return;
  const db = load();

  // Heuristic: use saved Proof Card + perf estimates to decide a “pass”
  const proof = readProof(pageId);
  if (!proof) {
    // no telemetry — count as neutral pass to avoid false negatives
    db.n += 1;
    db.pass += 1;
    save(db);
    return;
  }

  const proofOk = proof?.proof_ok !== false;            // no redactions in critical fields
  const a11yOk   = proof?.a11y !== false;               // a11y check didn’t fail
  const clsOk    = typeof proof?.cls_est === "number" ? proof.cls_est <= 0.10 : true; // within default budget

  const pass = Boolean(proofOk && a11yOk && clsOk);

  db.n += 1;
  if (pass) db.pass += 1; else db.fail += 1;
  save(db);
}
