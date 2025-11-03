// server/metrics/outcome.ts
import fs from "fs";
const DIR = ".cache";
const FILE_EVENTS = `${DIR}/outcome.events.jsonl`;
const FILE_AGG = `${DIR}/outcome.agg.json`;

type ShipEvent = {
  ts: number;
  pageId: string; // stable key (e.g., dslKey)
  url?: string | null;
  sections: string[];
  brand: { primary?: string; tone?: string; dark?: boolean };
  scores: { visual?: number; a11y?: boolean; bytes?: number | null };
  sessionId?: string;
};
type ConvEvent = { ts: number; pageId: string };

type Agg = {
  bySection: Record<string, { ships: number; convs: number }>;
  byBrandSig: Record<string, { ships: number; convs: number }>;
};

function ensure() {
  try {
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  } catch {}
}
function readAgg(): Agg {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE_AGG, "utf8"));
  } catch {
    return { bySection: {}, byBrandSig: {} };
  }
}
function writeAgg(a: Agg) {
  ensure();
  fs.writeFileSync(FILE_AGG, JSON.stringify(a, null, 2));
}
function brandSig(b: ShipEvent["brand"]) {
  return [
    b?.tone || "serious",
    b?.dark ? "dark" : "light",
    (b?.primary || "#").slice(0, 7).toLowerCase(),
  ].join("|");
}

export function recordShip(ev: ShipEvent) {
  ensure();
  try {
    fs.appendFileSync(FILE_EVENTS, JSON.stringify({ kind: "ship", ...ev }) + "\n");
  } catch {}
  const agg = readAgg();
  const bsig = brandSig(ev.brand);
  for (const sec of ev.sections) {
    const s = agg.bySection[sec] || (agg.bySection[sec] = { ships: 0, convs: 0 });
    s.ships += 1;
  }
  const b = agg.byBrandSig[bsig] || (agg.byBrandSig[bsig] = { ships: 0, convs: 0 });
  b.ships += 1;
  writeAgg(agg);
}

export function markConversion(pageId: string) {
  ensure();
  try {
    fs.appendFileSync(
      FILE_EVENTS,
      JSON.stringify({ kind: "convert", ts: Date.now(), pageId }) + "\n"
    );
  } catch {}
  const agg = readAgg();
  // naive: award 1 conv to all sections/brandSig seen in last ship for this pageId
  try {
    const lines = fs.readFileSync(FILE_EVENTS, "utf8").trim().split(/\r?\n/).slice(-500);
    const lastShipLine = [...lines]
      .reverse()
      .find((l) => {
        try {
          return JSON.parse(l).kind === "ship" && JSON.parse(l).pageId === pageId;
        } catch {
          return false;
        }
      });
    if (lastShipLine) {
      const ship = JSON.parse(lastShipLine) as any;
      const bsig = brandSig(ship.brand);
      for (const sec of ship.sections) {
        const s = agg.bySection[sec] || (agg.bySection[sec] = { ships: 0, convs: 0 });
        s.convs += 1;
      }
      const b =
        agg.byBrandSig[bsig] || (agg.byBrandSig[bsig] = { ships: 0, convs: 0 });
      b.convs += 1;
    }
  } catch {}
  writeAgg(agg);
}

export function kpiSummary() {
  const agg = readAgg();
  const topSections = Object.entries(agg.bySection)
    .map(([k, v]) => ({
      section: k,
      ships: v.ships,
      convs: v.convs,
      cr: v.ships ? +((v.convs / v.ships) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.cr - a.cr)
    .slice(0, 12);
  const topBrandSigs = Object.entries(agg.byBrandSig)
    .map(([k, v]) => ({
      brandSig: k,
      ships: v.ships,
      convs: v.convs,
      cr: v.ships ? +((v.convs / v.ships) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.cr - a.cr)
    .slice(0, 12);
  return { topSections, topBrandSigs };
}

// expose the last ship for a page id, for bandit credit on conversion
export function lastShipFor(pageId: string) {
  ensure();
  try {
    if (!fs.existsSync(FILE_EVENTS)) return null;
    const lines = fs.readFileSync(FILE_EVENTS, "utf8").trim().split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const j = JSON.parse(lines[i]);
      if (j.kind === "ship" && j.pageId === pageId) return j;
    }
  } catch {}
  return null;
}

// --- lightweight url cost tracking for /metrics ---

export type UrlCostSnapshot = {
  hits: number;
  tokens: number;
  cents: number;
  conversions: number;
};

type UrlKey = string;

const urlStats = new Map<UrlKey, UrlCostSnapshot>();

// per-workspace stats (workspaceId-scoped)
type WorkspaceStats = {
  hits: number;
  tokens: number;
  cents: number;
  conversions: number;
};

const workspaceUrlCosts = new Map<string, WorkspaceStats>();

function normalizeUrlKey(
  url: string | null | undefined,
  pageId: string | null | undefined
): UrlKey | null {
  const u = (url || "").trim();
  const p = (pageId || "").trim();

  if (p) return `page:${p}`;
  if (u) return `url:${u}`;
  return null;
}

// For /outcome: record a "ship" with basic cost info
export function recordUrlCost(
  url: string | null | undefined,
  pageId: string | null | undefined,
  tokens: number,
  cents: number,
  workspaceId?: string | null
) {
  const key = normalizeUrlKey(url, pageId);
  if (!key) return;

  const cur =
    urlStats.get(key) || {
      hits: 0,
      tokens: 0,
      cents: 0,
      conversions: 0,
    };

  cur.hits += 1;
  if (Number.isFinite(tokens)) cur.tokens += tokens;
  if (Number.isFinite(cents)) cur.cents += cents;

  urlStats.set(key, cur);

  // --- per-workspace metrics (non-breaking) ---
  if (workspaceId) {
    const baseKey = url || pageId;
    if (baseKey) {
      const wkKey = `${workspaceId}::${baseKey}`;
      let ws = workspaceUrlCosts.get(wkKey);
      if (!ws) {
        ws = { hits: 0, tokens: 0, cents: 0, conversions: 0 };
        workspaceUrlCosts.set(wkKey, ws);
      }
      ws.hits += 1;
      ws.tokens += tokens || 0;
      ws.cents += cents || 0;
    }
  }
}

// For /kpi/convert: bump conversions for a pageId or URL
export function recordUrlConversion(
  identifier: string | null | undefined,
  workspaceId?: string | null
) {
  const raw = (identifier || "").trim();
  if (!raw) return;

  let key: UrlKey;
  if (raw.startsWith("pg_")) {
    key = `page:${raw}`;
  } else {
    key = `url:${raw}`;
  }

  const cur =
    urlStats.get(key) || {
      hits: 0,
      tokens: 0,
      cents: 0,
      conversions: 0,
    };

  cur.conversions += 1;
  urlStats.set(key, cur);

  // --- per-workspace conversions ---
  if (workspaceId && raw) {
    const wkKey = `${workspaceId}::${raw}`;
    let ws = workspaceUrlCosts.get(wkKey);
    if (!ws) {
      ws = { hits: 0, tokens: 0, cents: 0, conversions: 0 };
      workspaceUrlCosts.set(wkKey, ws);
    }
    ws.conversions += 1;
  }
}

// Snapshot used by /metrics
export function snapshotUrlCosts(): Record<string, UrlCostSnapshot> {
  const out: Record<string, UrlCostSnapshot> = {};
  for (const [k, v] of urlStats.entries()) {
    out[k] = { ...v };
  }

  // --- attach per-workspace breakdown ---
  const byKey: Record<string, Record<string, WorkspaceStats>> = {};

  for (const [wkKey, stats] of workspaceUrlCosts.entries()) {
    const sepIndex = wkKey.indexOf("::");
    if (sepIndex <= 0) continue;
    const workspaceId = wkKey.slice(0, sepIndex);
    const key = wkKey.slice(sepIndex + 2);
    if (!workspaceId || !key) continue;

    if (!byKey[key]) byKey[key] = {};
    byKey[key][workspaceId] = { ...stats };
  }

  for (const key of Object.keys(byKey)) {
    if (!out[key]) continue; // only attach to keys that exist in base metrics
    (out[key] as any).byWorkspace = byKey[key];
  }

  return out;
}

// Test helper
export function resetOutcomeMetrics() {
  urlStats.clear();
  workspaceUrlCosts.clear();
}
