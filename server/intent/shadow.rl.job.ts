// server/intent/shadow.rl.job.ts

import {
  type ShadowEvent,
  type PriorConfig,
  type RlSummary,
  summarizeRlRewards,
  updateProviderPriors,
} from "./shadow.rl";

export interface RlPolicySnapshot {
  version: number;
  updatedAtTs: number; // epoch millis
  priors: PriorConfig;
  lastSummary: RlSummary;
}

export interface RlJobResult {
  snapshot: RlPolicySnapshot;
}

/**
 * Core "nightly RL job" logic.
 *
 * A real job runner would:
 * - Read ShadowEvent logs from storage.
 * - Load the previous snapshot from config.
 * - Call this function.
 * - Persist the new snapshot.
 *
 * We only do the pure transformation here so it is easy to test.
 */
export function runShadowRlJob(
  events: ShadowEvent[],
  prevSnapshot: RlPolicySnapshot | null,
  learningRate = 0.1,
  nowTs = Date.now()
): RlJobResult {
  const summary = summarizeRlRewards(events);

  const prevPriors: PriorConfig = prevSnapshot?.priors || {};
  const updatedPriors = updateProviderPriors(
    prevPriors,
    summary,
    learningRate
  );

  const version = (prevSnapshot?.version ?? 0) + 1;

  const snapshot: RlPolicySnapshot = {
    version,
    updatedAtTs: nowTs,
    priors: updatedPriors,
    lastSummary: summary,
  };

  return { snapshot };
}
