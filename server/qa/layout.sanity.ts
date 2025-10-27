// server/qa/layout.sanity.ts
export function quickLayoutSanity(html: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  const take = (n: number, msg: string) => {
    if (n > 0) issues.push(msg);
    score -= Math.min(10, n * 3);
  };

  // 1) <img> without BOTH width & height → CLS risk
  const imgs = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((m) => m[0]);
  const imgNoDims = imgs.filter((tag) => !/width\s*=/.test(tag) || !/height\s*=/.test(tag)).length;
  take(imgNoDims, `${imgNoDims} <img> missing width/height`);

  // 2) <iframe>/<video> without width/height
  const iframes = Array.from(html.matchAll(/<iframe\b[^>]*>/gi)).map((m) => m[0]);
  const vids = Array.from(html.matchAll(/<video\b[^>]*>/gi)).map((m) => m[0]);
  const iframeNoDims = iframes.filter((tag) => !/width\s*=/.test(tag) || !/height\s*=/.test(tag)).length;
  const videoNoDims = vids.filter((tag) => !/width\s*=/.test(tag) || !/height\s*=/.test(tag)).length;
  take(iframeNoDims, `${iframeNoDims} <iframe> missing width/height`);
  take(videoNoDims, `${videoNoDims} <video> missing width/height`);

  // 3) Oversized H1 → likely wrap/overflow on mobile
  const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const text = h1Match[1].replace(/<[^>]+>/g, "").trim();
    if (text.length > 90) {
      issues.push(`H1 very long (${text.length} chars)`);
      score -= 8;
    }
    if (/[A-Z]{12,}/.test(text)) {
      issues.push("H1 has long ALL-CAPS run");
      score -= 5;
    }
  }

  // 4) Images without decoding hint (minor)
  const imgNoDecoding = imgs.filter((tag) => !/decoding\s*=\s*"(async|auto)"/i.test(tag)).length;
  if (imgNoDecoding > 2) {
    issues.push(`${imgNoDecoding} <img> missing decoding="async|auto"`);
    score -= 4;
  }

  // 5) Any element forcibly hiding overflow (possible clipping)
  const overflowHidden = (html.match(/overflow\s*:\s*hidden/gi) || []).length;
  if (overflowHidden > 5) {
    issues.push(`Many overflow:hidden declarations (${overflowHidden})`);
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));
  return { score, issues };
}

// --- add at bottom of server/qa/layout.sanity.ts ---

// Quick CLS/LCP heuristics from HTML only (no browser run)
// - cls_est: 0.00–0.35 (good <0.1)
// - lcp_est_ms: 600–4000 (good <2500)
export function quickPerfEst(html: string) {
  const src = String(html || "");

  const imgTags = Array.from(src.matchAll(/<img\b[^>]*>/gi)).map((m) => m[0]);
  // FIXED: more accurate check for intrinsic sizing or style sizing (width/height/aspect-ratio)
  const imgsNoSize = imgTags
    .filter((tag) => {
      const hasW = /\bwidth\s*=\s*["']?\d+/i.test(tag);
      const hasH = /\bheight\s*=\s*["']?\d+/i.test(tag);
      const hasStyleSize = /style\s*=\s*["'][^"']*\b(width|height|aspect-ratio)\s*:/i.test(tag);
      return !((hasW && hasH) || hasStyleSize);
    })
    .length;

  const webfontLinks = (src.match(/fonts\.googleapis\.com|@font-face/gi) || []).length;
  const hasFontDisplaySwap = /font-display\s*:\s*swap/gi.test(src) || /display=swap/gi.test(src);

  const cssLinks = (src.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi) || []).length;

  // inline JS weight (rough)
  const inlineJSBytes = Array.from(
    src.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)
  ).reduce((n, m) => n + (m[1]?.length || 0), 0);
  const inlineJSKB = Math.round(inlineJSBytes / 1024);

  // Heuristic CLS: images without fixed size + webfonts w/o swap
  let cls = 0.05 + Math.min(0.25, imgsNoSize * 0.05);
  if (webfontLinks && !hasFontDisplaySwap) cls += 0.03;
  cls = Math.max(0, Math.min(0.35, Number(cls.toFixed(3))));

  // Heuristic LCP: start at 1200ms, add penalties
  let lcp = 1200;
  const heroLazy = /<img[^>]+loading=["']lazy["'][^>]*>/i.test(src.slice(0, 2000));
  if (heroLazy) lcp += 400;
  if (webfontLinks && !hasFontDisplaySwap) lcp += 300;
  if (cssLinks > 1) lcp += 300;
  if (inlineJSKB > 30) lcp += 400;
  lcp = Math.max(600, Math.min(4000, lcp));

  return {
    cls_est: Number(cls.toFixed(3)),
    lcp_est_ms: lcp,
    reasons: {
      images_without_size: imgsNoSize,
      webfonts: webfontLinks,
      css_stylesheets: cssLinks,
      inline_js_kb: inlineJSKB,
      font_display_swap: hasFontDisplaySwap,
    },
  };
}

// Matrix-lite: mobile/desktop × light/dark × fast/slow (heuristic)
// Returns base, per-scenario rows, and a "worst" pick to gate training.
export function matrixPerfEst(html: string) {
  const base = quickPerfEst(html);
  const hasViewport = /<meta\s+name=["']viewport["'][^>]+width=device-width/i.test(html);

  const variants = [
    { device: "mobile", theme: "light", net: "fast" },
    { device: "mobile", theme: "dark", net: "slow" },
    { device: "desktop", theme: "light", net: "fast" },
    { device: "desktop", theme: "dark", net: "slow" },
  ] as const;

  const rows = variants.map((v) => {
    let cls = base.cls_est;
    let lcp = base.lcp_est_ms;

    // Mobile without a viewport tends to shift more
    if (v.device === "mobile" && !hasViewport) cls = Math.min(0.35, cls + 0.04);

    // Dark theme: tiny extra paint/jank budget
    if (v.theme === "dark") lcp += 80;

    // Slow net: add a fixed latency bump
    if (v.net === "slow") lcp = Math.min(4000, lcp + 800);

    return { ...v, cls_est: Number(cls.toFixed(3)), lcp_est_ms: lcp };
  });

  const worst = rows.reduce(
    (w, r) => (r.cls_est > w.cls_est || r.lcp_est_ms > w.lcp_est_ms ? r : w),
    rows[0]
  );

  return { base, rows, worst };
}
