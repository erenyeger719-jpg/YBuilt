// server/intent/retrieval.ts
import fs from "fs";
import path from "path";

/** -------------------- Types -------------------- **/
export type Example = {
  slug: string; // stable key (e.g., "hero-basic", "pricing-simple@a")
  tags: string[]; // quick facets ("saas","dark","waitlist","pricing")
  text: string; // compact description / canonical copy
  weight?: number; // optional prior boost (default 1)
  updatedAt?: number; // ms since epoch
};

type DB = { user: Example[] };

type NearestOpts = {
  k?: number;
  sections?: string[];
  brand?: { tone?: string; dark?: boolean };
};

/** -------------------- Storage (lightweight) -------------------- **/
const FILE = path.join(".cache", "retrieval.examples.json");
function loadDB(): DB {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { user: [] };
  }
}
function saveDB(db: DB) {
  try {
    fs.mkdirSync(".cache", { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  } catch {}
}

const db = loadDB();

/** -------------------- Curated hardcoded seeds (50+) -------------------- **/
const SEED_BANK: Example[] = [
  { slug: "hero-basic", tags: ["saas", "waitlist", "hero", "neutral"], text: "clean hero with title, sub, email capture" },
  { slug: "hero-basic@b", tags: ["saas", "hero", "alt"], text: "alt hero layout, right media, left copy" },
  { slug: "features-3col", tags: ["features", "grid", "3col"], text: "three-column features with icons" },
  { slug: "features-3col@alt", tags: ["features", "grid", "3col", "alt"], text: "compact 3-col features, tight spacing" },
  { slug: "pricing-simple", tags: ["pricing", "cards"], text: "simple 3-tier pricing with primary CTA" },
  { slug: "pricing-simple@a", tags: ["pricing", "alt"], text: "two-tier pricing, annual toggle" },
  { slug: "faq-accordion", tags: ["faq", "accordion"], text: "faq accordion 6 questions" },
  { slug: "cta-slim", tags: ["cta", "band"], text: "slim full-width CTA bar with email field" },
  { slug: "testimonials-grid", tags: ["social", "proof"], text: "quote grid with avatars" },
  { slug: "logos-row", tags: ["social", "logos"], text: "trusted-by logos row" },
  { slug: "stats-4up", tags: ["kpi", "stats"], text: "stats 4-up with bold numerals" },
  { slug: "hero-dark", tags: ["saas", "waitlist", "hero", "dark"], text: "dark hero with gradient and email capture" },
  { slug: "hero-video", tags: ["hero", "media", "video"], text: "hero with autoplay loop video" },
  { slug: "feature-split", tags: ["features", "split"], text: "side-by-side feature with image and bullets" },
  { slug: "feature-split@alt", tags: ["features", "split", "alt"], text: "media-left, copy-right variant" },
  { slug: "pricing-comparison", tags: ["pricing", "table"], text: "comparison table free vs pro" },
  { slug: "faq-minimal", tags: ["faq", "minimal"], text: "minimal stacked questions" },
  { slug: "footer-slim", tags: ["footer", "slim"], text: "slim footer with legal links" },
  { slug: "navbar-simple", tags: ["nav", "simple"], text: "simple navbar with brand and cta" },
  { slug: "navbar-sticky", tags: ["nav", "sticky"], text: "sticky nav on scroll" },
  { slug: "gallery-3x3", tags: ["gallery", "grid"], text: "image gallery 3x3" },
  { slug: "blog-list", tags: ["blog", "list"], text: "blog article list with tags" },
  { slug: "signup-inline", tags: ["form", "email", "cta"], text: "inline email signup form" },
  { slug: "cta-primary", tags: ["cta", "primary"], text: "primary CTA panel with headline" },
  { slug: "contact-simple", tags: ["contact", "form"], text: "contact form with address" },
  { slug: "about-team", tags: ["about", "team"], text: "team avatars and roles" },
  { slug: "roadmap", tags: ["product", "roadmap"], text: "public roadmap list" },
  { slug: "changelog", tags: ["product", "changelog"], text: "release notes list" },
  { slug: "integrations-grid", tags: ["integrations", "grid"], text: "integrations grid with badges" },
  { slug: "hero-launch", tags: ["launch", "hero"], text: "launch hero with countdown" },
  { slug: "countdown", tags: ["launch", "countdown"], text: "countdown band" },
  { slug: "feature-cards", tags: ["features", "cards"], text: "feature cards 3-up with icons" },
  { slug: "steps-3", tags: ["howitworks", "steps"], text: "how it works in 3 steps" },
  { slug: "steps-4", tags: ["howitworks", "steps"], text: "how it works in 4 steps" },
  { slug: "newsletter-cta", tags: ["email", "cta"], text: "newsletter subscription block" },
  { slug: "pricing-enterprise", tags: ["pricing", "enterprise"], text: "enterprise contact us card" },
  { slug: "case-studies", tags: ["social", "proof", "stories"], text: "case studies list" },
  { slug: "quote-banner", tags: ["social", "quote"], text: "single large quote banner" },
  { slug: "faq-split", tags: ["faq", "split"], text: "faq beside illustration" },
  { slug: "footer-rich", tags: ["footer", "columns"], text: "footer with 3 columns and newsletter" },
  { slug: "navbar-mega", tags: ["nav", "mega"], text: "mega menu navbar" },
  { slug: "hero-minimal", tags: ["hero", "minimal"], text: "minimal hero, big type" },
  { slug: "hero-center", tags: ["hero", "center"], text: "centered hero with subtext" },
  { slug: "pricing-free", tags: ["pricing", "free"], text: "free plan highlighted" },
  { slug: "press-logos", tags: ["social", "logos", "press"], text: "as seen in logos" },
  { slug: "faq-quick", tags: ["faq", "quick"], text: "short faq list" },
  { slug: "trust-badges", tags: ["social", "trust"], text: "security/trust badges row" },
  { slug: "cookie-banner", tags: ["compliance", "cookie"], text: "cookie consent banner" },
  { slug: "gdpr-note", tags: ["compliance", "gdpr"], text: "gdpr note in footer" },
  { slug: "hero-product", tags: ["hero", "product"], text: "product screenshot hero" },
].map((e) => ({
  ...e,
  weight: e.weight ?? 1,
  updatedAt: e.updatedAt ?? Date.now() - 7 * 864e5, // default: a week ago
}));

/** -------------------- Legacy/new seed coercion helper -------------------- **/
function coerceSeed(x: any): Example | null {
  if (!x) return null;
  // Already new shape
  if (x.slug && x.text && Array.isArray(x.tags)) return x as Example;

  // Legacy -> New
  const legacyText = String(x.text || "").trim();
  if (!legacyText) return null;

  const slug = String(x.slug || legacyText)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_@\-\.\/]/g, "");

  const tags: string[] = [];
  if (x.label) tags.push(String(x.label));
  if (legacyText.includes("@")) {
    const parts = legacyText.split("@");
    if (parts[1]) tags.push(parts[1]);
  }
  if (!tags.length) tags.push("section");

  return {
    slug,
    tags,
    text: legacyText,
    weight: typeof x.weight === "number" ? x.weight : 1,
    updatedAt: typeof x.updatedAt === "number" ? x.updatedAt : Date.now(),
  };
}

/** -------------------- Load external seeds (optional) -------------------- **/
const seedsPath = path.resolve(process.cwd(), "server/intent/seeds.json");
let SEEDS_FROM_FILE: Example[] = [];
try {
  const raw = JSON.parse(fs.readFileSync(seedsPath, "utf8"));
  const arr = Array.isArray(raw) ? raw : [];
  SEEDS_FROM_FILE = arr.map(coerceSeed).filter((v): v is Example => Boolean(v));
} catch {
  SEEDS_FROM_FILE = [];
}

/** -------------------- In-memory universe (Map) -------------------- **/
const EXAMPLE_MAP = new Map<string, Example>();

function normalizeExample(e: Example, fallbackAgeDays = 0): Example {
  return {
    ...e,
    weight: e.weight ?? 1,
    updatedAt:
      e.updatedAt ??
      (fallbackAgeDays > 0 ? Date.now() - fallbackAgeDays * 864e5 : Date.now()),
  };
}

// 1) Hardcoded curated seeds
for (const s of SEED_BANK) {
  if (!EXAMPLE_MAP.has(s.slug)) EXAMPLE_MAP.set(s.slug, normalizeExample(s, 7));
}

// 2) File-based seeds (if any)
for (const s of SEEDS_FROM_FILE) {
  if (!s?.slug) continue;
  if (!EXAMPLE_MAP.has(s.slug)) EXAMPLE_MAP.set(s.slug, normalizeExample(s));
}

// 3) User DB entries
for (const u of db.user) {
  EXAMPLE_MAP.set(u.slug, normalizeExample(u));
}

/** -------------------- Tokenizers / Scoring -------------------- **/
const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "with",
  "in",
  "on",
  "by",
  "at",
  "is",
  "be",
  "it",
  "this",
  "that",
]);

function norm(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9@/+\-_\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter || 1;
  return inter / uni;
}

function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return h >>> 0;
}

/** (Fix 1a) — query tokens DO NOT include example tags */
function scoreExample(q: string, ex: Example): number {
  const qTokOnly = new Set(norm(q)); // query only
  const eTok = new Set(norm(ex.text).concat(ex.tags || []).concat(norm(ex.slug)));
  const base = jaccard(qTokOnly, eTok);
  const boost = ex.weight || 1;
  return base * boost;
}

// ADD: map slugs to sections for shaped hits
function slugToSections(slug: string): string[] {
  const s = String(slug || "");
  const out = new Set<string>(["hero-basic", "cta-simple"]);
  if (/features/i.test(s)) out.add("features-3col");
  if (/pricing/i.test(s)) out.add("pricing-simple");
  return Array.from(out);
}

/** -------------------- Public API -------------------- **/
export function addExample(e: Example) {
  if (!e || !e.slug) return;
  const next = normalizeExample(e);
  // upsert into user DB
  const idx = db.user.findIndex((x) => x.slug === e.slug);
  if (idx >= 0) db.user[idx] = next;
  else db.user.push(next);
  saveDB(db);
  // upsert in-memory
  EXAMPLE_MAP.set(next.slug, next);
}

// REPLACE the existing nearest(...) implementation with this shaped version
export async function nearest(
  q: string | { text?: string; tags?: string[] },
  kOrOpts?: number | NearestOpts
): Promise<{ sections: string[]; score: number; match?: Example }> {
  // Keep your current ranking pipeline:
  const list = ((): Example[] => {
    // reuse your current scoring/sorting logic
    const k =
      typeof kOrOpts === "number"
        ? kOrOpts
        : typeof kOrOpts === "object" && kOrOpts?.k
        ? kOrOpts.k
        : 5;

    const universe = Array.from(EXAMPLE_MAP.values());
    const qStr = typeof q === "string" ? q : (q?.text || "");
    const scored = universe.map((ex) => ({
      item: ex,
      score: scoreExample(qStr, ex),
    }));

    // your deterministic tie-breaks stay the same
    const qLower = qStr.toLowerCase();
    const epsPrimary = 0.02;
    scored.sort((a, b) => {
      if (Math.abs(b.score - a.score) > epsPrimary) return b.score - a.score;

      const slA = qLower.includes(a.item.slug.toLowerCase());
      const slB = qLower.includes(b.item.slug.toLowerCase());
      if (slA !== slB) return slB ? 1 : -1;

      const tA = (a.item.tags || []).filter((t) =>
        qLower.includes(String(t).toLowerCase())
      ).length;
      const tB = (b.item.tags || []).filter((t) =>
        qLower.includes(String(t).toLowerCase())
      ).length;
      if (tA !== tB) return tB - tA;

      const rA = a.item.updatedAt || 0;
      const rB = b.item.updatedAt || 0;
      if (rA !== rB) return rB - rA;

      const hA = stableHash(a.item.slug);
      const hB = stableHash(b.item.slug);
      return hA - hB;
    });

    return scored.slice(0, Math.max(1, k)).map((x) => x.item);
  })();

  const best = list[0];
  if (best) {
    const qStr = typeof q === "string" ? q : (q?.text || "");
    return {
      sections: slugToSections(best.slug),
      score: scoreExample(qStr, best),
      match: best,
    };
  }
  // cold-start default
  return { sections: ["hero-basic", "cta-simple"], score: 0 };
}
