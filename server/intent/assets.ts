// server/intent/assets.ts
// Thin shim so the AI router can suggest/remember *and* synthesize vector assets
// without caring about storage. Provides suggestVectorAssets/rememberVectorAssets
// and a deterministic synthesizeAssets fallback (no external deps).

import fs from "fs";
import path from "path";
import crypto from "crypto";

import {
  suggestVectorAssets as _suggestVectorAssets,
  rememberVectorAssets as _rememberVectorAssets,
  __vectorLib_load as _load,
  __vectorLib_save as _save,
} from "../media/vector.lib.ts";

// ---- Types (loose) ----
export type SuggestArgs = { brand?: any; limit?: number };
export type RememberArgs = { copy?: Record<string, any>; brand?: any };
export type SynthesizeArgs = {
  brand?: { primary?: string; dark?: boolean; tone?: string };
  tags?: string[];
  count?: number; // how many placeholders to ensure
};

// ---- Public APIs expected by router.ts ----
export function suggestVectorAssets(args: SuggestArgs = {}) {
  const out = _suggestVectorAssets(args) || {};
  const cp = { ...(out.copyPatch || {}) };
  for (const [k, v] of Object.entries(cp)) {
    if (typeof v === "string" && !v.startsWith("/vectors/")) delete (cp as any)[k];
  }
  return { ...out, copyPatch: cp };
}
export function rememberVectorAssets(args: RememberArgs = {}) {
  return _rememberVectorAssets(args);
}

// Back-compat aliases some older code may import
export function suggestAssets(args: SuggestArgs = {}) {
  return _suggestVectorAssets(args);
}
export function rememberAssets(args: RememberArgs = {}) {
  return _rememberVectorAssets(args);
}

// === Deterministic synth ===
// Creates N minimal SVGs in /public/vectors if corpus is thin and indexes them.
// Returns same shape as suggestVectorAssets(): { copyPatch, assets }
export async function synthesizeAssets({
  brand = {},
  tags = [],
  count = 3,
}: SynthesizeArgs = {}) {
  const dir = path.resolve("public/vectors");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const color = String(brand?.primary || "#6d28d9");
  const vibe = (String(brand?.tone || "minimal").toLowerCase() || "minimal") as
    | "minimal"
    | "playful"
    | "serious";

  // Ensure a few deterministic files exist
  const want = Math.max(1, Math.min(8, count || 3));
  const seeds = ["analytics", "security", "speed", "cloud", "code", "ai", "people", "support"];

  const created: string[] = [];
  for (let i = 0; i < want; i++) {
    const base = seeds[i % seeds.length];
    const file = path.join(dir, `${base}-${i + 1}.svg`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, makeSvgPlaceholder(base, color, vibe), "utf8");
      created.push(file);
    }
  }

  // Index into vector lib (mirror miner’s behavior)
  const db = _load();
  for (const abs of created) {
    const id = sha1(abs);
    const url = `/vectors/${path.basename(abs)}`;
    const deriv = deriveTagsFromName(abs, tags, vibe);
    db.assets[id] = {
      id,
      url,
      file: abs,
      tags: deriv.tags,
      industry: deriv.industry,
      vibe: deriv.vibe,
      addedTs: Date.now(),
    } as any;

    // Update inverted index
    for (const k of new Set<string>([...deriv.tags, ...deriv.industry, ...deriv.vibe])) {
      const key = String(k || "").toLowerCase();
      if (!key) continue;
      db.index[key] = db.index[key] || [];
      if (!db.index[key].includes(id)) db.index[key].push(id);
    }
  }
  if (created.length) _save(db);

  // Finally: prefer existing assets (including new ones) using the standard suggester
  const { copyPatch, assets } = _suggestVectorAssets({ brand, limit: want });

  // If suggester returns nothing (shouldn’t happen), create a minimal copy patch
  if (!copyPatch || Object.keys(copyPatch).length === 0) {
    const urls = listVectorUrls(dir).slice(0, want);
    const patch: Record<string, string> = {};
    if (urls[0]) patch.HERO_ILLUSTRATION_URL = urls[0];
    if (urls[1]) patch.FEATURES_ICON_1_URL = urls[1];
    if (urls[2]) patch.FEATURES_ICON_2_URL = urls[2];
    return { copyPatch: patch, assets: [] as any[] };
  }

  return { copyPatch, assets };
}

// ---- Helpers ----
function sha1(s: string) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function listVectorUrls(dir: string) {
  try {
    return (fs.readdirSync(dir) || [])
      .filter((f) => f.endsWith(".svg"))
      .map((f) => `/vectors/${f}`);
  } catch {
    return [];
  }
}

function deriveTagsFromName(abs: string, extraTags: string[], vibe: string) {
  const name = path.basename(abs).toLowerCase();
  const tags = new Set<string>(extraTags.map((t) => String(t || "").toLowerCase()));
  const industry = new Set<string>();
  const vibeSet = new Set<string>([vibe]);

  if (name.includes("analytic") || name.includes("chart") || name.includes("graph")) tags.add("analytics");
  if (name.includes("lock") || name.includes("secure") || name.includes("security")) tags.add("security");
  if (name.includes("speed") || name.includes("rocket") || name.includes("bolt")) tags.add("speed");
  if (name.includes("cloud") || name.includes("server") || name.includes("network")) tags.add("cloud");
  if (name.includes("code") || name.includes("dev") || name.includes("terminal")) tags.add("code");
  if (name.includes("ai") || name.includes("neural") || name.includes("brain") || name.includes("circuit")) tags.add("ai");
  if (name.includes("shop") || name.includes("cart") || name.includes("ecom")) tags.add("ecommerce");
  if (name.includes("team") || name.includes("user") || name.includes("avatar")) tags.add("people");
  if (name.includes("support") || name.includes("chat") || name.includes("message")) tags.add("support");

  // industry: infer nothing aggressive here; keep empty unless obvious in extraTags
  for (const t of extraTags) {
    const k = String(t || "").toLowerCase();
    if (["saas", "ecommerce", "portfolio", "education", "agency"].includes(k)) industry.add(k);
  }

  return { tags: Array.from(tags), industry: Array.from(industry), vibe: Array.from(vibeSet) };
}

function makeSvgPlaceholder(kind: string, color: string, vibe: "minimal" | "playful" | "serious") {
  const stroke = vibe === "playful" ? "none" : color;
  const fill = vibe === "playful" ? color : "none";
  const strokeWidth = vibe === "serious" ? 3 : 2;

  // Tiny shape variety by kind
  const shape =
    kind.includes("analytic") || kind.includes("chart")
      ? `<rect x="10" y="34" width="12" height="20" rx="2" stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}"/>
         <rect x="28" y="24" width="12" height="30" rx="2" stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}"/>
         <rect x="46" y="14" width="12" height="40" rx="2" stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}"/>`
      : kind.includes("security") || kind.includes("lock")
      ? `<rect x="12" y="26" width="40" height="26" rx="6" stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}"/>
         <path d="M24 26 v-6 a8 8 0 0 1 16 0 v6" stroke="${stroke}" fill="none" stroke-width="${strokeWidth}"/>`
      : kind.includes("rocket") || kind.includes("speed")
      ? `<path d="M32 8 L40 28 L32 24 L24 28 Z" stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}"/>
         <path d="M32 24 L32 56" stroke="${stroke}" fill="none" stroke-width="${strokeWidth}"/>`
      : kind.includes("code") || kind.includes("dev")
      ? `<path d="M22 18 L14 32 L22 46" stroke="${stroke}" fill="none" stroke-width="${strokeWidth}"/>
         <path d="M42 18 L50 32 L42 46" stroke="${stroke}" fill="none" stroke-width="${strokeWidth}"/>`
      : `<circle cx="32" cy="32" r="18" stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
  ${shape}
</svg>`;
}

// Default export bag
export default {
  suggestVectorAssets,
  rememberVectorAssets,
  suggestAssets,
  rememberAssets,
  synthesizeAssets,
};

// Re-export vector lib (handy if other imports rely on it)
export * from "../media/vector.lib.ts";
