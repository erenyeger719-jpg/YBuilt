// server/intent/shadowEval.ts
import fs from "fs";
import path from "path";
import { localLabels } from "./localLabels.ts";

const METRICS = path.resolve(".cache", "shadow.metrics.json");
const SAMPLES = path.resolve(".cache", "shadow.samples.jsonl");

function ensureDir() {
  try {
    const dir = path.dirname(METRICS);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
}
function loadJSON<T = any>(p: string, def: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return def;
  }
}
function saveJSON(p: string, obj: any) {
  try {
    ensureDir();
    fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  } catch {}
}
function ema(prev: number | null, x: number, a = 0.25) {
  return prev == null ? x : (1 - a) * prev + a * x;
}
function jaccard(a: string[], b: string[]) {
  const A = new Set(a.map(String));
  const B = new Set(b.map(String));
  let inter = 0;
  for (const v of A) if (B.has(v)) inter++;
  const union = A.size + B.size - inter || 1;
  return inter / union;
}

type ShadowPayload = { prompt: string; spec: any; sessionId?: string };

/**
 * Non-blocking “shadow” evaluation:
 * - runs local labeler on the prompt
 * - compares with shipped spec (sections/mode/tone)
 * - records aggregate metrics only
 */
export function queueShadowEval({ prompt = "", spec = {}, sessionId = "anon" }: ShadowPayload) {
  setTimeout(async () => {
    try {
      const lab = await localLabels(prompt);
      const pred = lab?.intent || {};

      const shippedSections: string[] = Array.isArray(spec?.layout?.sections)
        ? spec.layout.sections.map(String)
        : [];
      const predictedSections: string[] = Array.isArray(pred.sections) ? pred.sections.map(String) : [];

      const secScore = jaccard(shippedSections, predictedSections);
      const shipMode = spec?.brand?.dark ? "dark" : "light";
      const modeScore = Number(shipMode === (pred.color_scheme || ""));
      const shipTone = String(spec?.brand?.tone || "");
      const predTone = String(pred.vibe || "");
      // map non-minimal vibes to "serious" to keep it simple/robust
      const normPredTone = predTone === "minimal" || predTone === "playful" ? predTone : "serious";
      const toneScore = shipTone ? Number(shipTone === normPredTone) : 0;

      // weighted blend, thresholds are conservative
      const score = 0.6 * secScore + 0.25 * modeScore + 0.15 * toneScore;
      const pass = score >= 0.6;

      const m = loadJSON(METRICS, { n: 0, pass: 0, ema_score: null as number | null });
      m.n = (m.n || 0) + 1;
      m.pass = (m.pass || 0) + (pass ? 1 : 0);
      m.ema_score = ema(m.ema_score, score);
      saveJSON(METRICS, m);

      // sample log (best effort)
      try {
        ensureDir();
        const rec = {
          ts: Date.now(),
          sessionId,
          score: Number(score.toFixed(3)),
          pass,
          shippedSections,
          predictedSections,
          shipMode,
          predMode: pred.color_scheme || "",
          shipTone,
          predTone: normPredTone,
        };
        fs.appendFileSync(SAMPLES, JSON.stringify(rec) + "\n");
      } catch {}
    } catch {}
  }, 0);
}
