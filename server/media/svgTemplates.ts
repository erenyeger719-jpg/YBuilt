// server/media/svgTemplates.ts

function clampHex(c: string, fallback = "#6d28d9") {
  const m = String(c || "").match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  return m ? m[0] : fallback;
}
function esc(s: string) {
  return String(s || "").replace(/[<>&"]/g, (m) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[m]!));
}
function initials(s: string) {
  const parts = String(s || "A I").trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || "").join("") || "AI";
}
function hash(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type SvgParams = {
  primary?: string;
  dark?: boolean;
  text?: string; // used by logo
  seed?: string; // to keep variants stable
  width?: number;
  height?: number;
};

export function svgAbstractWaves(p: SvgParams = {}) {
  const W = p.width || 1200, H = p.height || 600;
  const primary = clampHex(p.primary);
  const bg = p.dark ? "#0b0b0b" : "#ffffff";
  const id = "g" + (p.seed ? hash(p.seed).toString(16) : "0");
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Abstract waves">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${primary}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="${bg}"/>
  <g fill="url(#${id})">
    <path d="M0 ${H*0.75} C ${W*0.25} ${H*0.6}, ${W*0.5} ${H*0.9}, ${W} ${H*0.7} L ${W} ${H} L 0 ${H} Z"/>
    <path opacity="0.5" d="M0 ${H*0.65} C ${W*0.2} ${H*0.5}, ${W*0.55} ${H*0.8}, ${W} ${H*0.6} L ${W} ${H} L 0 ${H} Z"/>
  </g>
</svg>`.trim();
}

export function svgBadgeLogo(p: SvgParams = {}) {
  const W = p.width || 256, H = p.height || 256;
  const primary = clampHex(p.primary);
  const bg = p.dark ? "#111111" : "#ffffff";
  const text = initials(p.text || "");
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Logo ${esc(text)}">
  <rect width="100%" height="100%" rx="${Math.round(W*0.2)}" fill="${bg}"/>
  <circle cx="${W/2}" cy="${H/2}" r="${Math.min(W,H)/3}" fill="${primary}" />
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"
        font-size="${Math.round(Math.min(W,H)/3.2)}" fill="${p.dark ? "#0b0b0b" : "#ffffff"}"
        letter-spacing="1">${esc(text)}</text>
</svg>`.trim();
}

export function svgIconSparkles(p: SvgParams = {}) {
  const W = p.width || 160, H = p.height || 160;
  const primary = clampHex(p.primary);
  const bg = p.dark ? "#0b0b0b" : "#ffffff";
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Sparkle icon">
  <rect width="100%" height="100%" fill="${bg}"/>
  <g fill="${primary}">
    <path d="M${W*0.5} ${H*0.15} L ${W*0.56} ${H*0.44} L ${W*0.85} ${H*0.5} L ${W*0.56} ${H*0.56} L ${W*0.5} ${H*0.85} L ${W*0.44} ${H*0.56} L ${W*0.15} ${H*0.5} L ${W*0.44} ${H*0.44} Z"/>
    <circle cx="${W*0.78}" cy="${H*0.25}" r="${Math.min(W,H)*0.04}"/>
    <circle cx="${W*0.22}" cy="${H*0.78}" r="${Math.min(W,H)*0.06}"/>
  </g>
</svg>`.trim();
}

export type VectorKind = "logo" | "icon" | "illustration";

export function renderSvg(kind: VectorKind, params: SvgParams & { label?: string }) {
  if (kind === "logo") return svgBadgeLogo(params);
  if (kind === "icon") return svgIconSparkles(params);
  return svgAbstractWaves(params); // "illustration"
}
