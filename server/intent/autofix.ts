// server/intent/autofix.ts
export type ReviewOp = { file: string; find: string; replace: string; isRegex?: boolean };

function clip(s: string, n = 160) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function ensureHead(html: string) {
  if (/<head\b[^>]*>/i.test(html)) return html;
  return html.replace(/<body\b/i, "<head></head>\n<body");
}

export function safeHtmlAutoFix(htmlIn: string, spec: any = {}) {
  let html = String(htmlIn || "");
  const changes: string[] = [];

  html = ensureHead(html);

  // <title>
  if (!/<title>\s*[^<]{2,}\s*<\/title>/i.test(html)) {
    const title =
      spec?.copy?.SITE_TITLE ||
      spec?.copy?.HERO_TITLE ||
      spec?.summary ||
      "Preview";
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n<title>${clip(title, 60)}</title>`);
    changes.push("add:<title>");
  }

  // meta description (50–160)
  const descRaw =
    spec?.copy?.TAGLINE ||
    spec?.copy?.HERO_SUB ||
    spec?.copy?.DESCRIPTION ||
    spec?.summary ||
    "";
  const desc = clip(descRaw, 160);

  const hasMeta = /<meta\s+name=["']description["'][^>]*>/i.test(html);
  if (!hasMeta) {
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n<meta name="description" content="${desc}">`);
    changes.push("add:meta[name=description]");
  } else {
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      (m) => m.replace(/content=["'][^"']*["']/i, `content="${desc}"`)
    );
    changes.push("fix:meta[name=description]");
  }

  // h1 exactly one
  const opens = [...html.matchAll(/<h1\b[^>]*>/gi)].length;
  if (opens === 0) {
    // upgrade first h2 to h1
    let upgraded = false;
    html = html.replace(/<h2\b([^>]*)>/i, (_m, attrs) => {
      upgraded = true;
      changes.push("upgrade:first <h2>→<h1>");
      return `<h1${attrs}>`;
    });
    if (upgraded) {
      let closed = false;
      html = html.replace(/<\/h2>/i, () => {
        closed = true;
        return "</h1>";
      });
    }
  } else if (opens > 1) {
    let count = 0;
    html = html.replace(/<h1\b([^>]*)>/gi, (_m, attrs) => {
      count++;
      return count === 1 ? `<h1${attrs}>` : `<h2${attrs}>`;
    });
    let ccount = 0;
    html = html.replace(/<\/h1>/gi, () => {
      ccount++;
      return ccount === 1 ? "</h1>" : "</h2>";
    });
    changes.push("demote:extra <h1>→<h2>");
  }

  // <img> add alt when missing
  html = html.replace(/<img\b([^>]*?)>/gi, (m, attrs) => {
    if (/alt\s*=/.test(attrs)) return m;
    const src = /src\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] || "";
    const name = src.split(/[\/\\]/).pop()?.split(".")[0] || "image";
    const nice = clip(name.replace(/[-_]+/g, " ").trim(), 80);
    changes.push("add:img[alt]");
    const tail = attrs.trim().endsWith("/") ? "" : "";
    return `<img${attrs} alt="${nice}">`;
  });

  // <a> short text → add aria-label from href host
  html = html.replace(/<a\b([^>]*)>(.*?)<\/a>/gis, (m, attrs, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, "").trim();
    if (text.length >= 3 || /aria-label=/.test(attrs)) return m;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] || "";
    let label = "Open link";
    try {
      const u = new URL(href, "https://x.local");
      label = `Open ${u.hostname.replace(/^www\./, "")}`;
    } catch {}
    changes.push("add:a[aria-label]");
    return `<a${attrs} aria-label="${label}">${inner}</a>`;
  });

  return { html, changes };
}

// Apply only index.html ops from critic
export function applyIndexOps(htmlIn: string, ops: ReviewOp[] = []) {
  let html = String(htmlIn || "");
  let applied = 0;
  for (const op of ops) {
    if (String(op.file) !== "index.html") continue;
    try {
      if (op.isRegex) {
        const re = new RegExp(op.find, "g");
        const next = html.replace(re, op.replace);
        if (next !== html) {
          html = next;
          applied++;
        }
      } else {
        if (html.includes(op.find)) {
          html = html.split(op.find).join(op.replace);
          applied++;
        }
      }
    } catch {
      /* ignore bad ops */
    }
  }
  return { html, applied };
}
