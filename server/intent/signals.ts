// server/intent/signals.ts
type Sig = { ts: number; kind: string; data?: any };
const STORE: Record<string, Sig[]> = {};

export function pushSignal(sessionId: string, sig: Sig) {
  if (!STORE[sessionId]) STORE[sessionId] = [];
  STORE[sessionId].push({ ts: Date.now(), ...sig });
}

export function summarize(sessionId: string) {
  const list = STORE[sessionId] || [];
  const now = Date.now();
  const last15m = list.filter(s => now - s.ts < 15 * 60_000);
  const counts: Record<string, number> = {};
  for (const s of last15m) counts[s.kind] = (counts[s.kind] || 0) + 1;

  return {
    total: last15m.length,
    counts,
    last: last15m.slice(-5),
  };
}

export function boostConfidence(base: number, summary: ReturnType<typeof summarize>) {
  let c = base;
  if (summary.counts['compose_success']) c += 0.05;
  if (summary.counts['chip_apply']) c += 0.03;
  if (summary.counts['chip_more_detail']) c -= 0.02;
  return Math.max(0.4, Math.min(0.95, c));
}
