// server/sup/metrics.northstar.ts

export type SupLabel = "tp" | "tn" | "fp" | "fn";

export interface SupAuditEvent {
  ts: number; // timestamp (ms since epoch)
  route: string;
  workspaceId?: string | null;

  // Performance / cost
  latencyMs?: number | null;
  costCents?: number | null;

  // Optional label for offline evaluation
  label?: SupLabel;
}

export interface NorthstarSummary {
  total: number;

  // Confusion matrix
  tp: number;
  tn: number;
  fp: number;
  fn: number;

  // Rates (null when not computable)
  fnRate: number | null; // false negatives / positives
  fpRate: number | null; // false positives / negatives

  // Latency & cost
  p95LatencyMs: number | null;
  avgCostCents: number | null;

  // How many events actually had labels
  labeledCount: number;
  labelCoverage: number; // 0..1
}

/**
 * Compute SUP north-star metrics from a batch of audit-like events.
 * This is intentionally pure and deterministic for easy testing.
 */
export function summarizeNorthstarMetrics(events: SupAuditEvent[]): NorthstarSummary {
  const total = events.length;

  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  const latencies: number[] = [];
  const costs: number[] = [];

  for (const ev of events) {
    if (typeof ev.latencyMs === "number" && Number.isFinite(ev.latencyMs)) {
      latencies.push(ev.latencyMs);
    }
    if (typeof ev.costCents === "number" && Number.isFinite(ev.costCents)) {
      costs.push(ev.costCents);
    }

    switch (ev.label) {
      case "tp":
        tp++;
        break;
      case "tn":
        tn++;
        break;
      case "fp":
        fp++;
        break;
      case "fn":
        fn++;
        break;
      default:
      // unlabeled -> ignored for confusion matrix
    }
  }

  const labeledCount = tp + tn + fp + fn;

  // FN rate: out of all actual positives (tp + fn), how many did we miss?
  const positives = tp + fn;
  const fnRate =
    positives > 0
      ? fn / positives
      : labeledCount > 0
      ? 0
      : null;

  // FP rate: out of all actual negatives (tn + fp), how many did we wrongly block?
  const negatives = tn + fp;
  const fpRate =
    negatives > 0
      ? fp / negatives
      : labeledCount > 0
      ? 0
      : null;

  // p95 latency
  let p95LatencyMs: number | null = null;
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.floor(0.95 * (sorted.length - 1));
    p95LatencyMs = sorted[idx];
  }

  // Average cost
  let avgCostCents: number | null = null;
  if (costs.length > 0) {
    const sum = costs.reduce((acc, v) => acc + v, 0);
    avgCostCents = sum / costs.length;
  }

  const labelCoverage = total > 0 ? labeledCount / total : 0;

  return {
    total,
    tp,
    tn,
    fp,
    fn,
    fnRate,
    fpRate,
    p95LatencyMs,
    avgCostCents,
    labeledCount,
    labelCoverage,
  };
}
