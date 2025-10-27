// server/intent/tests.ts
import fs from "fs"; // not used now, kept for future extensions
import path from "path"; // same

export type Issue = {
  type: "a11y" | "seo" | "perf" | "html" | "content";
  msg: string;
  hint?: string;
  where?: string;
};

function findAll(re: RegExp, s: string) {
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = r.exec(s))) out.push(m);
  return out;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  if (![3, 6].includes(h.length)) return null;
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(v, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function relLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const t = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = t(r), G = t(g), B = t(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrastRatio(fg: string, bg: string) {
  const F = hexToRgb(fg), B = hexToRgb(bg);
  if (!F || !B) return null;
  const L1 = relLuminance(F), L2 = relLuminance(B);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

export function runStaticChecks(input: {
  html: string;
  css?: string;
  js?: string;
  brandPrimary?: string;   // e.g. "#6d28d9"
  dark?: boolean;          // page mode hint
}) {
  const html = String(input.html || "");
  const css = String(input.css || "");
  const js = String(input.js || "");
  const issues: Issue[] = [];

  // --- HTML sanity ---
  if (!/<title>\s*[^<]{2,}\s*<\/title>/i.test(html)) {
    issues.push({ type: "html", msg: "<title> missing or empty", hint: "Add a meaningful, concise title (40–60 chars)" });
  }
  const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1] || "";
  if (metaDesc.length < 50 || metaDesc.length > 180) {
    issues.push({ type: "seo", msg: "Meta description out of range", hint: "Aim for ~50–160 chars" });
  }

  const h1s = findAll(/<h1\b[^>]*>/gi, html).length;
  if (h1s !== 1) issues.push({ type: "a11y", msg: "Page should have exactly one <h1>", hint: "Keep one top-level heading" });

  // a11y: <img alt="">
  const imgs = findAll(/<img\b[^>]*>/gi, html);
  for (const m of imgs) {
    const tag = m[0];
    const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (alt == null || alt.trim() === "") {
      issues.push({ type: "a11y", msg: "<img> missing meaningful alt", where: tag.slice(0, 120) + "…" });
    }
  }

  // a11y: links with text
  const links = findAll(/<a\b[^>]*>(.*?)<\/a>/gis, html);
  for (const m of links) {
    const inner = m[1].replace(/<[^>]+>/g, "").trim();
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(m[0])?.[1] || "";
    if (href && inner.length < 3) {
      issues.push({ type: "a11y", msg: "Link text too short", where: `href=${href}` });
    }
  }

  // perf-ish: inline size budgets (coarse but useful)
  const htmlKB = Buffer.byteLength(html, "utf8") / 1024;
  const cssKB = Buffer.byteLength(css, "utf8") / 1024;
  const jsKB = Buffer.byteLength(js, "utf8") / 1024;
  if (htmlKB > 200) issues.push({ type: "perf", msg: `HTML too large (${htmlKB.toFixed(0)}KB)`, hint: "<200KB target" });
  if (cssKB > 120) issues.push({ type: "perf", msg: `CSS too large (${cssKB.toFixed(0)}KB)`, hint: "<120KB target" });
  if (jsKB > 200) issues.push({ type: "perf", msg: `JS too large (${jsKB.toFixed(0)}KB)`, hint: "<200KB target" });

  // contrast check using brand color vs bg (white/black by mode)
  if (input.brandPrimary) {
    const bg = input.dark ? "#000000" : "#FFFFFF";
    const cr = contrastRatio(input.brandPrimary, bg);
    if (cr != null && cr < 4.5) {
      issues.push({ type: "a11y", msg: `Brand contrast low (${cr.toFixed(2)}:1)`, hint: "Increase contrast to ≥ 4.5:1" });
    }
  }

  // simple score: start at 100, subtract 6 per issue (min 0)
  const score = Math.max(0, 100 - issues.length * 6);
  const pass = score >= 70 && !issues.some(i => i.type === "html" || i.type === "a11y");

  return { pass, score, issues };
}
