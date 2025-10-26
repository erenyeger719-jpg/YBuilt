// server/intent/router.brain.ts
import { pickArm, recordOutcome, underBudget } from "./stats.ts";

export type LabelPath = "rules" | "local" | "cloud";

export function decideLabelPath(): LabelPath {
  // bandit picks among arms for this request
  return pickArm();
}

export function outcomeLabelPath(path: LabelPath, info: {
  startedAt: number;
  cloudUsed?: boolean;
  tokens?: number;
  cents?: number;
  shipped?: boolean;    // true if we produced a preview URL
}) {
  const ms = Date.now() - info.startedAt;
  const success = Boolean(info.shipped && !info.cloudUsed); // prefer zero-cloud success
  recordOutcome(path, {
    success,
    ms,
    cents: info.cents ?? 0,
    tokens: info.tokens ?? 0,
  });
}

// budget gate (used before any cloud call)
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
