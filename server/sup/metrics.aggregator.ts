// server/sup/metrics.aggregator.ts

export type SupDecision = "allow" | "block";

/**
 * Ground-truth label for an event.
 * - "good"  = request/page was actually safe to ship
 * - "bad"   = request/page was actually unsafe, should have been blocked
 */
export type SupLabel = "good" | "bad";

export interface SupEvent {
  decision: SupDecision;
  label: SupLabel;
  // Latency in milliseconds for this request (if known).
  latencyMs?: number | null;
  // Cost in cents for this request (if known).
  costCents?: number | null;
  // URL or key we want to group by for cost.
  url?: string | null;
}

export interface SupMetricsSummary {
  // Raw counts
  total: number;
  truePositives: number;   // block + bad
  falsePositives: number;  // block + good
  trueNegatives: number;   // allow + good
  falseNegatives: number;  // allow + bad

  // Simple rates (0..1), NaN-safe (0 when denominators are 0)
  falseNegativeRate: number;
  falsePositiveRate: number;

  // Latency p95 in milliseconds, or null when no data.
  p95LatencyMs: number | null;

  // Aggregated cost per URL (in cents).
  costPerUrlCents: Record<string, number>;
}

/**
 * Aggregate a batch of labeled SUP events into simple metrics:
 * - FN/FP counts + rates
 * - p95 latency
 * - cost per URL
 *
 * This is intentionally dumb + deterministic – callers decide how often
 * and where to run it (cron, endpoint, etc.).
 */
export function aggregateSupEvents(events: SupEvent[]): SupMetricsSummary {
  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;

  const latencies: number[] = [];
  const costPerUrl: Record<string, number> = Object.create(null);

  for (const ev of events) {
    const { decision, label } = ev;

    // Count confusion matrix entries.
    if (decision === "block" && label === "bad") {
      truePositives++;
    } else if (decision === "block" && label === "good") {
      falsePositives++;
    } else if (decision === "allow" && label === "good") {
      trueNegatives++;
    } else if (decision === "allow" && label === "bad") {
      falseNegatives++;
    }

    // Latency collection (ignore non-finite).
    if (
      typeof ev.latencyMs === "number" &&
      Number.isFinite(ev.latencyMs) &&
      ev.latencyMs >= 0
    ) {
      latencies.push(ev.latencyMs);
    }

    // Cost per URL aggregation.
    if (
      typeof ev.costCents === "number" &&
      Number.isFinite(ev.costCents) &&
      ev.costCents > 0 &&
      ev.url
    ) {
      const key = ev.url;
      const prev = costPerUrl[key] ?? 0;
      costPerUrl[key] = prev + ev.costCents;
    }
  }

  const total = truePositives + falsePositives + trueNegatives + falseNegatives;

  const fnDen = truePositives + falseNegatives;
  const fpDen = trueNegatives + falsePositives;

  const falseNegativeRate = fnDen > 0 ? falseNegatives / fnDen : 0;
  const falsePositiveRate = fpDen > 0 ? falsePositives / fpDen : 0;

  const p95LatencyMs = computeP95(latencies);

  return {
    total,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    falseNegativeRate,
    falsePositiveRate,
    p95LatencyMs,
    costPerUrlCents: costPerUrl,
  };
}

/**
 * Compute a simple p95 (95th percentile) from a list of numbers.
 * Returns null when the list is empty.
 */
function computeP95(values: number[]): number | null {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const idxFloat = 0.95 * (sorted.length - 1);
  const lowerIdx = Math.floor(idxFloat);
  const upperIdx = Math.ceil(idxFloat);

  if (lowerIdx === upperIdx) {
    return sorted[lowerIdx];
  }

  const weight = idxFloat - lowerIdx;
  const lower = sorted[lowerIdx];
  const upper = sorted[upperIdx];

  return lower + (upper - lower) * weight;
}
