// server/intent/router.brain.ts
import { expertsForTask } from "./experts.ts";
export { expertByKey } from "./experts.ts";
import {
  pickArm,
  recordOutcome,
  underBudget,
  chooseExpertKey,
  recordExpertOutcome as _recordExpertOutcome,
} from "./stats.ts";

export type LabelPath = "rules" | "local" | "cloud";
export type Task = "planner" | "coder" | "critic";

/** Multi-armed bandit choice among label paths for this request */
export function decideLabelPath(): LabelPath {
  return pickArm();
}

/** Report outcome for a chosen label path (prefers zero-cloud success). */
export function outcomeLabelPath(
  path: LabelPath,
  info: {
    startedAt: number;
    cloudUsed?: boolean;
    tokens?: number;
    cents?: number;
    shipped?: boolean; // true if we produced a preview URL
  }
) {
  const ms = Date.now() - info.startedAt;
  const success = Boolean(info.shipped && !info.cloudUsed);
  recordOutcome(path, {
    success,
    ms,
    cents: info.cents ?? 0,
    tokens: info.tokens ?? 0,
  });
}

/** Budget gate used before any cloud call. */
export function allowCloud(opts?: { cents?: number; tokens?: number }) {
  const maxCents = Number(process.env.CLOUD_MAX_CENTS || 0.6);
  const maxTokens = Number(process.env.CLOUD_MAX_TOKENS || 4800);
  return underBudget({
    cents: opts?.cents ?? 0,
    tokens: opts?.tokens ?? 0,
    maxCents,
    maxTokens,
  });
}

/* ----------------------------- Expert picker ----------------------------- */

export function pickExpertFor(
  task: Task,
  opts?: { maxCents?: number }
) {
  const cands = expertsForTask(task, opts?.maxCents);
  if (!cands.length) return undefined;
  const key = chooseExpertKey(cands.map((c) => c.key));
  return cands.find((c) => c.key === key) || cands[0];
}

export function recordExpertOutcome(
  key: string,
  info: { success: boolean; ms?: number; cents?: number; tokens?: number }
) {
  try {
    _recordExpertOutcome(key, info);
  } catch {
    // best effort; do not throw
  }
}
