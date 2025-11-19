// server/seo/og.ts
// Deterministic OG/Social bundle (no external deps).
// - Generates an SVG OG image under /public/og/*.svg
// - Returns OG meta { title, description, image }
// - Exposes many aliases (buildSEO, buildOg, ensureOG, ogMeta, …) for router back-compat.

import fs from "fs";
import path from "path";
import crypto from "crypto";

type Brand = { primary?: string; dark?: boolean; tone?: string };
type Spec = {
  brand?: Brand;
  copy?: Record<string, any>;
  intent?: { goal?: string };
};

function slugify(s: string) {
  return (
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "page"
  );
}
function hash(...parts: string[]) {
  const h = crypto.createHash("sha1");
  for (const p of parts) h.update(String(p || ""));
  return h.digest("hex").slice(0, 12);
}

function pickBg(brand: Brand = {}) {
  const p = (brand.primary || "#6d28d9").trim();
  const dark = !!brand.dark;
  const bg = dark ? "#0b0b10" : "#f6f6fb";
  const fg = dark ? "#e8e8ff" : "#0b0b10";
  return { bg, fg, accent: p };
}

function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" } as any)[c]);
}

function ogSvg({ title, subtitle, brand }: { title: string; subtitle: string; brand: Brand }) {
  const { bg, fg, accent } = pickBg(brand);
  const safeTitle = escapeXml(title || "Build Something People Want");
  const safeSub = escapeXml(subtitle || "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${bg}"/>
  <rect x="30" y="30" width="1140" height="570" rx="24" fill="url(#g)"/>
  <circle cx="1080" cy="120" r="80" fill="${accent}" fill-opacity="0.08"/>
  <circle cx="180" cy="520" r="120" fill="${accent}" fill-opacity="0.05"/>

  <g transform="translate(96,180)">
    <text x="0" y="0" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, sans-serif"
          font-weight="800" font-size="78" fill="${fg}">
      ${safeTitle}
    </text>
  </g>

  <g transform="translate(96,270)">
    <text x="0" y="0" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, sans-serif"
          font-weight="500" font-size="36" fill="${fg}" opacity="0.8">
      ${safeSub}
    </text>
  </g>
</svg>`;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Core: ensure OG image on disk and return meta
export function ensureOg(spec: Spec = {}) {
  const brand = spec.brand || {};
  const copy = spec.copy || {};
  const title = (copy.OG_TITLE as string) || (copy.HEADLINE as string) || "Build Something People Want";
  const description = (copy.OG_DESC as string) || (copy.TAGLINE as string) || "Launch faster. Look credible. No fluff.";

  const slug = slugify(title);
  const id = hash(title, description, brand.primary || "", String(brand.dark));
  const relPath = `og/${slug}-${id}.svg`;
  const absDir = path.resolve("public/og");
  const absPath = path.resolve("public", relPath);

  ensureDir(absDir);
  if (!fs.existsSync(absPath)) {
    try {
      const svg = ogSvg({ title, subtitle: description, brand });
      fs.writeFileSync(absPath, svg, "utf8");
    } catch {
      ensureDir(absDir);
      fs.writeFileSync(absPath, ogSvg({ title: "Ybuilt", subtitle: "Preview", brand }), "utf8");
    }
  }

  const image = `/${relPath}`; // served by express.static('public')
  return {
    title,
    description,
    image,
    copyPatch: {
      OG_TITLE: title,
      OG_DESC: description,
      OG_IMAGE_URL: image,
    },
  };
}

// Aliases for back-compat with various routers
export const ensureOG = ensureOg;
export function buildOg(spec: Spec = {}) { return ensureOg(spec); }
export const buildOG = buildOg;

// NEW: routers sometimes import buildSEO / buildSeo / ensureSEO
// replace the current buildSEO with this exact version
export function buildSEO(spec: Spec = {}) {
  const r = ensureOg(spec);
  return {
    meta: { title: r.title, description: r.description, image: r.image },
    copyPatch: r.copyPatch,
  };
}

export const buildSeo = buildSEO;
export const ensureSEO = ensureOg;

// Lightweight meta-only helper
export function ogMeta(spec: Spec = {}) {
  const { title, description, image } = ensureOg(spec);
  return { title, description, image };
}

// More historical names people forget to remove 🙃
export function prepareOg(spec: Spec = {}) { return ensureOg(spec); }
export function ogForSpec(spec: Spec = {}) { return ensureOg(spec); }
export function attachOg(spec: Spec = {}) { return ensureOg(spec); }
export function writeOg(spec: Spec = {}) { return ensureOg(spec); }

export default {
  ensureOg,
  ensureOG,
  buildOg,
  buildOG,
  buildSEO,
  buildSeo,
  ensureSEO,
  ogMeta,
  prepareOg,
  ogForSpec,
  attachOg,
  writeOg,
};
