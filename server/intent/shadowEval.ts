// server/intent/shadowEval.ts
import fs from "fs";
import path from "path";
import { localLabels } from "./localLabels.ts";

const DIR = path.resolve(".cache");
const FILE_LOG = path.join(DIR, "shadow.eval.jsonl");
const FILE_METRICS = path.join(DIR, "shadow.metrics.json");

function ensure() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE_METRICS)) {
    fs.writeFileSync(FILE_METRICS, JSON.stringify({ n: 0, ema_score: null, pass: 0 }, null, 2));
  }
}

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter || 1;
  return inter / union;
}

function ema(prev: number | null, x: number, a = 0.25) {
  return prev == null ? x : (1 - a) * prev + a * x;
}

type Input = { prompt: string; spec: any; sessionId?: string };

export async function queueShadowEval(input: Input) {
  // fire-and-forget; never block request
  setImmediate(async () => {
    try {
      ensure();
      const { prompt, spec, sessionId = "anon" } = input;
      const lab = await localLabels(prompt).catch(() => null);

      const wantSections = new Set(String(lab?.intent?.sections || []).split(",").filter(Boolean));
      // If localLabels returns array, normalize properly:
      if (Array.isArray(lab?.intent?.sections)) {
        wantSections.clear();
        for (const s of lab!.intent!.sections) wantSections.add(String(s));
      }

      const gotSections = new Set<string>();
      for (const s of spec?.layout?.sections || []) gotSections.add(String(s));

      const secJ = jaccard(wantSections, gotSections);

      const wantTone =
        lab?.intent?.vibe === "playful"
          ? "playful"
          : lab?.intent?.vibe === "minimal"
          ? "minimal"
          : lab?.intent?.vibe === "serious"
          ? "serious"
          : "";
      const gotTone = String(spec?.brand?.tone || "");
      const toneOK = wantTone && gotTone ? (wantTone === gotTone ? 1 : 0) : 0;

      const wantDark = lab?.intent?.color_scheme === "dark";
      const gotDark = !!spec?.brand?.dark;
      const darkOK = Number(wantDark === gotDark);

      // Weighted agreement score
      const score = 0.6 * secJ + 0.2 * toneOK + 0.2 * darkOK;
      const pass = Number(score >= 0.7);

      // append JSONL (best-effort)
      try {
        const logLine = JSON.stringify(
          { ts: Date.now(), sessionId, score, secJ, toneOK, darkOK, want: lab?.intent, got: { sections: [...gotSections], tone: gotTone, dark: gotDark } }
        );
        fs.appendFileSync(FILE_LOG, logLine + "\n");
      } catch {}

      // update metrics (ema + pass rate)
      try {
        const m = JSON.parse(fs.readFileSync(FILE_METRICS, "utf8"));
        const n = (m.n || 0) + 1;
        const ema_score = ema(m.ema_score == null ? null : Number(m.ema_score), score);
        const pass_total = (m.pass || 0) + pass;
        fs.writeFileSync(FILE_METRICS, JSON.stringify({ n, ema_score, pass: pass_total }, null, 2));
      } catch {}
    } catch {
      // swallow — shadow eval must never explode caller
    }
  });
}
