// server/metrics/sup.summary.ts
// Tiny SUP metrics brain: summarize SUP audit rows.

export type SupAuditRow = {
  mode?: string; // "allow" | "strict" | "block"
  ms?: number;   // latency in ms
  pii_present?: boolean;
  abuse_reasons?: string[];
};

export type SupSummary = {
  total: number;
  modes: {
    allow: number;
    strict: number;
    block: number;
    other: number;
  };
  avg_ms: number | null;
  p95_ms: number | null;
  pii_present: number;
  abuse_with_reasons: number;
};

/**
 * Summarize a list of SUP audit rows (as written by supGuard).
 * Pure function: no file I/O, no globals.
 */
export function summarizeSupAudit(rows: SupAuditRow[]): SupSummary {
  let total = 0;
  let allow = 0;
  let strict = 0;
  let block = 0;
  let other = 0;

  const durations: number[] = [];
  let piiCount = 0;
  let abuseCount = 0;

  for (const raw of rows || []) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as SupAuditRow;

    total++;

    const mode = (row.mode || "").toLowerCase();
    if (mode === "allow") allow++;
    else if (mode === "strict") strict++;
    else if (mode === "block") block++;
    else other++;

    if (
      typeof row.ms === "number" &&
      Number.isFinite(row.ms) &&
      row.ms >= 0
    ) {
      durations.push(row.ms);
    }

    if (row.pii_present) piiCount++;

    if (Array.isArray(row.abuse_reasons) && row.abuse_reasons.length > 0) {
      abuseCount++;
    }
  }

  let avg_ms: number | null = null;
  let p95_ms: number | null = null;

  if (durations.length > 0) {
    const sum = durations.reduce((a, b) => a + b, 0);
    avg_ms = sum / durations.length;

    const sorted = [...durations].sort((a, b) => a - b);
    const idx = Math.floor(0.95 * (sorted.length - 1));
    p95_ms = sorted[idx];
  }

  return {
    total,
    modes: { allow, strict, block, other },
    avg_ms,
    p95_ms,
    pii_present: piiCount,
    abuse_with_reasons: abuseCount,
  };
}
