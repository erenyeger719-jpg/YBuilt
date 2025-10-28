// server/sections/packs.ts
// Lightweight section "marketplace" with learning-to-rank.
// API used by router: listPacksRanked(), recordPackSeenForPage(), recordPackWinForPage()

import fs from "fs";
import path from "path";

type Pack = {
  id: string;
  name: string;
  sections: string[];
  tags?: string[];
};

type Metrics = {
  // per pack
  packs: Record<
    string,
    {
      seen: number;
      wins: number;
      lastSeenTs?: number;
      lastWinTs?: number;
    }
  >;
  // best-match attribution for pages so later /kpi/convert can reward the pack
  pagePack: Record<string, string>; // pageId -> packId
  _meta?: { lastDecayTs?: number };
};

const FILE = path.resolve(".cache/packs.metrics.json");

function load(): Metrics {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { packs: {}, pagePack: {}, _meta: {} };
  }
}
function save(m: Metrics) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(m, null, 2));
  } catch {}
}

// ---- Catalog (curated starter inventory) ----
// Keep IDs stable; router will log wins/seen against these.
// Note: use only existing section ids: hero-basic, features-3col, pricing-simple, faq-accordion, cta-simple
const CATALOG: Pack[] = [
  // Core
  { id: "p-lean", name: "Hero Only", sections: ["hero-basic"], tags: ["zero-latency", "minimal"] },
  { id: "p-hero-cta", name: "Hero + CTA", sections: ["hero-basic", "cta-simple"], tags: ["core", "fast"] },
  { id: "p-hero-features", name: "Hero + 3-Features", sections: ["hero-basic", "features-3col"], tags: ["saas", "portfolio"] },
  { id: "p-hero-pricing", name: "Hero + Pricing", sections: ["hero-basic", "pricing-simple"], tags: ["conversion", "pricing-first"] },
  { id: "p-hero-faq", name: "Hero + FAQ", sections: ["hero-basic", "faq-accordion"], tags: ["info", "faq-first"] },

  // CTA led
  { id: "p-hero-features-cta", name: "Hero + 3-Features + CTA", sections: ["hero-basic", "features-3col", "cta-simple"], tags: ["saas", "agency"] },
  { id: "p-hero-pricing-cta", name: "Hero + Pricing + CTA", sections: ["hero-basic", "pricing-simple", "cta-simple"], tags: ["conversion"] },
  { id: "p-hero-faq-cta", name: "Hero + FAQ + CTA", sections: ["hero-basic", "faq-accordion", "cta-simple"], tags: ["info"] },

  // Heavier landings
  { id: "p-landing-heavy", name: "Hero + Features + Pricing + CTA", sections: ["hero-basic", "features-3col", "pricing-simple", "cta-simple"], tags: ["full", "saas"] },
  { id: "p-hero-features-faq", name: "Hero + Features + FAQ", sections: ["hero-basic", "features-3col", "faq-accordion"], tags: ["course", "app"] },
  { id: "p-hero-features-faq-cta", name: "Hero + Features + FAQ + CTA", sections: ["hero-basic", "features-3col", "faq-accordion", "cta-simple"], tags: ["course", "community"] },
  { id: "p-hero-pricing-faq", name: "Hero + Pricing + FAQ", sections: ["hero-basic", "pricing-simple", "faq-accordion"], tags: ["info", "conversion"] },
  { id: "p-hero-pricing-faq-cta", name: "Hero + Pricing + FAQ + CTA", sections: ["hero-basic", "pricing-simple", "faq-accordion", "cta-simple"], tags: ["conversion", "saas"] },

  // Focused flavors
  { id: "p-portfolio-lite", name: "Portfolio Lite", sections: ["hero-basic", "features-3col", "cta-simple"], tags: ["portfolio", "creator"] },
  { id: "p-agency-lead", name: "Agency Lead Gen", sections: ["hero-basic", "features-3col", "cta-simple"], tags: ["agency", "services"] },
  { id: "p-course-launch", name: "Course Launch", sections: ["hero-basic", "features-3col", "faq-accordion", "cta-simple"], tags: ["course", "edu"] },
  { id: "p-app-waitlist", name: "App Waitlist", sections: ["hero-basic", "cta-simple"], tags: ["app", "startup", "fast"] },
  { id: "p-ecom-preview", name: "Product Teaser", sections: ["hero-basic", "features-3col", "cta-simple"], tags: ["ecommerce", "product"] },

  // Max
  { id: "p-landing-max", name: "Hero + Features + Pricing + FAQ + CTA", sections: ["hero-basic", "features-3col", "pricing-simple", "faq-accordion", "cta-simple"], tags: ["full", "long"] },
];

// ---- Extra inventory (wider marketplace) ----
const EXTRA_PACKS: Array<Pick<Pack, "id" | "sections" | "tags">> = [
  { id: "saas-waitlist-v1",  tags: ["saas","waitlist","minimal"], sections: ["hero-basic","features-3col","cta-simple"] },
  { id: "saas-pricing-v1",   tags: ["saas","pricing"],           sections: ["hero-basic","pricing-simple","faq-accordion","cta-simple"] },
  { id: "portfolio-v1",      tags: ["portfolio","minimal"],      sections: ["hero-basic","features-3col","cta-simple"] },
  { id: "ecom-launch-v1",    tags: ["ecommerce","launch"],       sections: ["hero-basic","features-3col","cta-simple"] },
  { id: "agency-v1",         tags: ["agency"],                   sections: ["hero-basic","features-3col","faq-accordion","cta-simple"] },
  { id: "edu-course-v1",     tags: ["education"],                sections: ["hero-basic","features-3col","cta-simple"] },
  { id: "app-demo-v1",       tags: ["saas","demo"],              sections: ["hero-basic","features-3col","cta-simple"] },
  { id: "support-v1",        tags: ["support"],                  sections: ["hero-basic","faq-accordion","cta-simple"] },
  { id: "docs-landing-v1",   tags: ["docs"],                     sections: ["hero-basic","faq-accordion","cta-simple"] },
  { id: "founders-v1",       tags: ["saas","founders"],          sections: ["hero-basic","features-3col","pricing-simple","cta-simple"] },
  { id: "product-hunt-v1",   tags: ["launch","saas"],            sections: ["hero-basic","features-3col","cta-simple"] },
  { id: "beta-waitlist-v1",  tags: ["beta","waitlist"],          sections: ["hero-basic","faq-accordion","cta-simple"] },
];

// ---- Helpers ----
function jaccard(a: string[], b: string[]) {
  const A = new Set(a.map(String));
  const B = new Set(b.map(String));
  let inter = 0;
  for (const v of A) if (B.has(v)) inter++;
  return inter / Math.max(1, A.size + B.size - inter);
}

function wilsonLowerBound(wins: number, seen: number, z = 1.96) {
  if (seen <= 0) return 0;
  const phat = wins / seen;
  const denom = 1 + (z ** 2) / seen;
  const num =
    phat +
    (z ** 2) / (2 * seen) -
    z * Math.sqrt((phat * (1 - phat) + (z ** 2) / (4 * seen)) / seen);
  return num / denom;
}

function decayIfDue(m: Metrics) {
  const now = Date.now();
  const last = m._meta?.lastDecayTs || 0;
  // gentle weekly decay to keep fresh winners rising
  const WEEK = 7 * 24 * 3600 * 1000;
  if (now - last < WEEK) return;
  for (const k of Object.keys(m.packs)) {
    m.packs[k].seen = Math.max(0, Math.floor(m.packs[k].seen * 0.95));
    m.packs[k].wins = Math.max(0, Math.floor(m.packs[k].wins * 0.95));
  }
  m._meta = { ...(m._meta || {}), lastDecayTs: now };
}

// Humanize an id → name fallback (e.g., "saas-waitlist-v1" → "Saas Waitlist V1")
function humanizeId(id: string): string {
  return String(id)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

// Find best matching catalog pack for a concrete section list
function bestPackForSections(sections: string[]): Pack {
  let best: Pack = CATALOG[0];
  let bestScore = -1;
  for (const p of CATALOG) {
    const s = jaccard(p.sections, sections);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best;
}

// ---- Public API ----
export function recordPackSeenForPage(pageId: string, sections: string[]) {
  if (!pageId || !Array.isArray(sections)) return;
  const m = load();
  decayIfDue(m);

  const p = bestPackForSections(sections);
  const cur = (m.packs[p.id] = m.packs[p.id] || { seen: 0, wins: 0 });
  cur.seen += 1;
  cur.lastSeenTs = Date.now();
  m.pagePack[pageId] = p.id;

  save(m);
}

export function recordPackWinForPage(pageId: string) {
  if (!pageId) return;
  const m = load();
  const pid = m.pagePack[pageId];
  if (!pid) return;

  const cur = (m.packs[pid] = m.packs[pid] || { seen: 0, wins: 0 });
  cur.wins += 1;
  cur.lastWinTs = Date.now();
  save(m);
}

export function listPacksRanked(): Array<Pack & { score: number; seen: number; wins: number }> {
  const m = load();
  decayIfDue(m);

  // Merge curated catalog with extra inventory (derive names for extras)
  const mergedBase: Pack[] = [
    ...CATALOG,
    ...EXTRA_PACKS.map((p) => ({
      id: p.id,
      name: humanizeId(p.id),
      sections: p.sections,
      tags: p.tags,
    })),
  ];

  // ensure every pack has a metrics row
  for (const p of mergedBase) {
    if (!m.packs[p.id]) m.packs[p.id] = { seen: 0, wins: 0 };
  }

  const rows = mergedBase.map((p) => {
    const pm = m.packs[p.id] || { seen: 0, wins: 0 };
    const seen = pm.seen;
    const wins = pm.wins;

    const ctr = wilsonLowerBound(wins, seen);               // confidence-safe CTR
    const momentum = Math.log1p(seen) * 0.05;               // scale with exposure
    const freshness =
      pm.lastWinTs
        ? Math.max(0, 1 - (Date.now() - pm.lastWinTs) / (30 * 24 * 3600 * 1000)) * 0.1
        : 0;

    const score = ctr + momentum + freshness;
    return { ...p, score, seen, wins };
  });

  rows.sort((a, b) => b.score - a.score || (b.wins - a.wins) || (a.id.localeCompare(b.id)));
  return rows;
}
