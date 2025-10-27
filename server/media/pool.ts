// server/media/pool.ts
import fs from "fs";
import path from "path";
import { renderSvg, VectorKind } from "./svgTemplates.ts";

type MediaKind = "logo" | "icon" | "illustration" | "photo" | "video";
type Format = "svg" | "webp" | "mp4";

export type MediaRequest = {
  kind: MediaKind;
  prompt?: string;
  brand?: { primary?: string; dark?: boolean; tone?: "minimal" | "playful" | "serious" };
  prefer?: "vector" | "raster"; // default vector-first
  budget_cents?: number; // soft budget guard
  sessionId?: string;
  width?: number;
  height?: number;
  // optional provider hints
  provider?: "local" | "cloud";
};

type MediaAsset = {
  format: Format;
  inline?: string; // svg text for vector
  url?: string; // remote url for raster/video (if any)
  width?: number;
  height?: number;
  bytes?: number | null;
  note?: string;
  route: "vector_local" | "raster_cloud" | "video_cloud" | "fallback";
};

const CACHE_FILE = path.resolve(".cache", "media.cache.json");
const METRICS_FILE = path.resolve(".cache", "media.metrics.json");

function ensureCacheDir() {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function loadJSON<T = any>(p: string, def: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return def;
  }
}
function saveJSON(p: string, obj: any) {
  ensureCacheDir();
  try {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  } catch {}
}
function keyOf(r: MediaRequest) {
  const basis = JSON.stringify({
    kind: r.kind,
    prompt: r.prompt || "",
    brand: r.brand || {},
    prefer: r.prefer || "vector",
    w: r.width || 0,
    h: r.height || 0,
  });
  // use standard base64 then url-safe it (Node-version proof)
  return (
    "k" +
    Buffer.from(basis, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
      .slice(0, 64)
  );
}

// --- acceptance for SVG (cheap but useful) ---
function validateSvg(svg: string, maxKB = 80) {
  const s = String(svg || "");
  const bytes = Buffer.byteLength(s, "utf8");
  const okRoot = /^<svg[\s>]/i.test(s.trim());
  const noScript = !/<script\b/i.test(s);
  const noRemoteRefs = !/xlink:href\s*=\s*["']https?:/i.test(s) && !/href\s*=\s*["']https?:/i.test(s);
  const sizeOk = bytes / 1024 <= maxKB;
  const pass = okRoot && noScript && noRemoteRefs && sizeOk;
  return { pass, bytes };
}

// --- vector local path (preferred) ---
function generateVector(req: MediaRequest): MediaAsset {
  const kind: VectorKind = req.kind === "logo" || req.kind === "icon" ? req.kind : "illustration";
  const svg = renderSvg(kind, {
    primary: req.brand?.primary,
    dark: !!req.brand?.dark,
    text: req.prompt || "",
    seed: (req.prompt || "") + (req.brand?.primary || ""),
    width: req.width,
    height: req.height,
  });
  const check = validateSvg(svg);
  return {
    format: "svg",
    inline: svg,
    width: req.width,
    height: req.height,
    bytes: check.bytes,
    route: "vector_local",
    note: check.pass ? "svg_valid" : "svg_large_or_invalid",
  };
}

// --- stub cloud calls (optional) ---
async function callCloudImage(req: MediaRequest): Promise<MediaAsset> {
  // If you wire a real provider, do it here. Keep prompts tiny + schema-bound.
  // For now, return a tiny placeholder SVG as data-uri-like inline svg.
  const svg = renderSvg("illustration", {
    primary: req.brand?.primary || "#6d28d9",
    dark: !!req.brand?.dark,
    text: req.prompt || "",
    width: req.width || 1200,
    height: req.height || 600,
  });
  return {
    format: "svg",
    inline: svg,
    width: req.width || 1200,
    height: req.height || 600,
    bytes: Buffer.byteLength(svg, "utf8"),
    route: "raster_cloud",
    note: "placeholder_vector_fallback",
  };
}

async function callCloudVideo(_req: MediaRequest): Promise<MediaAsset> {
  // Placeholder: only allow if explicitly enabled via env flags in the future.
  return {
    format: "mp4",
    url: undefined,
    bytes: null,
    route: "video_cloud",
    note: "video_provider_not_configured",
  };
}

// --- simple bandit-ish chooser (vector-first, budget-aware) ---
function chooseRoute(req: MediaRequest) {
  const prefer = req.prefer || "vector";
  if (prefer === "vector") return "vector_local";
  if (req.kind === "logo" || req.kind === "icon" || req.kind === "illustration") return "vector_local";
  if (req.kind === "photo") return "raster_cloud";
  if (req.kind === "video") return "video_cloud";
  return "vector_local";
}

// --- public API ---
export async function generateMedia(req: MediaRequest): Promise<{ asset: MediaAsset; cached: boolean }> {
  ensureCacheDir();
  const cache = loadJSON<Record<string, MediaAsset>>(CACHE_FILE, {});
  const k = keyOf(req);

  if (cache[k]) return { asset: cache[k], cached: true };

  let asset: MediaAsset;
  const route = chooseRoute(req);

  if (route === "vector_local") {
    asset = generateVector(req);
    // If somehow invalid, still return; caller can decide to escalate.
  } else if (route === "raster_cloud") {
    asset = await callCloudImage(req);
  } else if (route === "video_cloud") {
    asset = await callCloudVideo(req);
  } else {
    asset = generateVector(req);
    asset.route = "fallback";
  }

  // record tiny metrics
  try {
    const m = loadJSON(METRICS_FILE, { n: 0, by_route: {} as Record<string, number> });
    m.n += 1;
    m.by_route[asset.route] = (m.by_route[asset.route] || 0) + 1;
    saveJSON(METRICS_FILE, m);
  } catch {}

  cache[k] = asset;
  saveJSON(CACHE_FILE, cache);
  return { asset, cached: false };
}
