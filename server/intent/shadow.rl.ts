// server/intent/shadow.rl.ts

export interface ShadowEvent {
  providerId: string;
  route: string;

  // Did the final shipped page convert?
  converted?: boolean;

  // How many edits did the user make? (0 = perfect, higher = worse)
  edits?: number;

  // Count of SUP / policy violations, if any.
  supViolations?: number;

  // Optional extras for later shaping.
  latencyMs?: number;
  costCents?: number;
}

export interface ProviderStats {
  providerId: string;
  count: number;
  avgReward: number;
}

export interface RlSummary {
  total: number;
  providers: ProviderStats[];
}

/**
 * Compute a scalar reward for a single shadow event.
 * +1 for a clean conversion, minus penalties for edits and violations.
 */
export function computeReward(ev: ShadowEvent): number {
  let reward = ev.converted ? 1 : 0;

  const edits =
    typeof ev.edits === "number" && Number.isFinite(ev.edits) && ev.edits > 0
      ? ev.edits
      : 0;
  if (edits > 0) {
    // Each edit costs 0.1, capped at -0.5 total.
    reward -= Math.min(0.5, edits * 0.1);
  }

  const violations =
    typeof ev.supViolations === "number" &&
    Number.isFinite(ev.supViolations) &&
    ev.supViolations > 0
      ? ev.supViolations
      : 0;
  if (violations > 0) {
    // Each violation costs 0.5, capped at -1 total.
    reward -= Math.min(1, violations * 0.5);
  }

  return reward;
}

/**
 * Aggregate rewards per provider so a nightly job can update routing priors.
 */
export function summarizeRlRewards(events: ShadowEvent[]): RlSummary {
  const byProvider = new Map<string, { sum: number; count: number }>();

  for (const ev of events) {
    const id = ev.providerId || "unknown";
    const r = computeReward(ev);

    const cur = byProvider.get(id) || { sum: 0, count: 0 };
    cur.sum += r;
    cur.count += 1;
    byProvider.set(id, cur);
  }

  const providers: ProviderStats[] = [];
  for (const [providerId, stats] of byProvider) {
    providers.push({
      providerId,
      count: stats.count,
      avgReward:
        stats.count > 0 ? stats.sum / stats.count : 0,
    });
  }

  providers.sort((a, b) => a.providerId.localeCompare(b.providerId));

  return {
    total: events.length,
    providers,
  };
}

export interface PriorConfig {
  [providerId: string]: number; // e.g. routing weight / bias
}

/**
 * Given a prior config and RL summary, return a new config
 * nudged toward the better-performing providers.
 */
export function updateProviderPriors(
  prior: PriorConfig,
  summary: RlSummary,
  learningRate = 0.1
): PriorConfig {
  const next: PriorConfig = { ...prior };

  for (const p of summary.providers) {
    const current =
      typeof prior[p.providerId] === "number" ? prior[p.providerId] : 0;
    const delta = p.avgReward * learningRate;
    next[p.providerId] = current + delta;
  }

  return next;
}
