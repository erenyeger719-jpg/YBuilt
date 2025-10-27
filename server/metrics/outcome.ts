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
