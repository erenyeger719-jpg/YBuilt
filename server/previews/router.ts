// server/previews/router.ts
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const CACHE = new Map<string, { slug: string; url: string }>();
const router = Router();

// ESM-clean imports
const { safeJoinTeam } = await import('../_teamPaths.ts');
const { persistFork } = await import('../previews.storage.ts');

function esc(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function safeColor(input: string, fallback = '#6d28d9') {
  const s = String(input || '').trim();
  const m = s.match(/^#?[0-9a-fA-F]{3,8}$/);
  return m ? (s.startsWith('#') ? s : `#${s}`) : fallback;
}

// ------- style tiers (premium default) -------
type Tier = 'premium' | 'minimal' | 'playful' | 'brutalist';
function tokensForTier(tier: Tier, dark: boolean, brand: string) {
  const brandHex = safeColor(brand || (dark ? '#7c3aed' : '#6d28d9'));
  const base = {
    wrap: '1120px',
    radius: '14px',
    shadow: dark ? '0 12px 32px rgba(0,0,0,0.35)' : '0 10px 30px rgba(0,0,0,0.15)',
    gap: '20px',
    space: '56px',
    btnPad: '12px 18px',
    border: '1px solid rgba(125,125,150,0.15)',
    cardBg: dark ? 'rgba(125,125,150,0.08)' : 'rgba(20,20,40,0.04)',
    brand: brandHex,
    gradFrom: brandHex,
    gradTo: dark ? '#2f1b7c' : '#8b5cf6',
  };
  if (tier === 'minimal')
    return { ...base, radius: '10px', shadow: 'none', gap: '16px', space: '44px', btnPad: '10px 16px', border: '1px solid rgba(125,125,150,0.12)' };
  if (tier === 'playful')
    return { ...base, radius: '18px', shadow: dark ? '0 16px 36px rgba(0,0,0,0.45)' : '0 14px 34px rgba(0,0,0,0.2)', gap: '22px', space: '60px' };
  if (tier === 'brutalist')
    return { ...base, radius: '0px', shadow: 'none', gap: '18px', space: '48px', border: dark ? '2px solid #fff' : '2px solid #111' };
  return base; // premium default
}
function cssVars(t: ReturnType<typeof tokensForTier>, dark: boolean) {
  const bg = dark ? '#0b0b0f' : '#ffffff';
  const fg = dark ? '#e8e8ee' : '#111111';
  return `
:root {
  --bg:${bg}; --fg:${fg}; --brand:${t.brand};
  --wrap:${t.wrap}; --radius:${t.radius}; --shadow:${t.shadow};
  --gap:${t.gap}; --space:${t.space}; --btn-pad:${t.btnPad};
  --border:${t.border}; --card-bg:${t.cardBg};
  --grad-from:${t.gradFrom}; --grad-to:${t.gradTo};
}`;}
function wrapHTML({
  title,
  dark,
  brand,
  tier,
  body,
}: {
  title: string;
  dark: boolean;
  brand: string;
  tier: Tier;
  body: string;
}) {
  const tk = tokensForTier(tier || 'premium', dark, brand);
  const vars = cssVars(tk, dark);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<title>${esc(title)}</title>
<style>
${vars}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:var(--wrap);margin:0 auto;padding:var(--space) 20px}
.btn{display:inline-block;background:linear-gradient(90deg,var(--grad-from),var(--grad-to));color:#fff;padding:var(--btn-pad);border-radius:var(--radius);text-decoration:none;box-shadow:var(--shadow)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gap)}
.card{background:var(--card-bg);border:var(--border);padding:16px;border-radius:var(--radius)}
.hero .sub{opacity:.88;max-width:64ch}
.hero h1{letter-spacing:-.01em;line-height:1.1;margin:0 0 12px;font-size:clamp(30px,4.2vw,48px)}
.section{margin-top:var(--space)}
@media (max-width:800px){.grid{grid-template-columns:1fr}}
</style></head><body>
${body}
</body></html>`;
}
function applyCopy(html: string, copy: Record<string, string>) {
  let out = html;
  for (const [k, v] of Object.entries(copy || {})) {
    out = out.replace(new RegExp(`\\{{2}${k}\\}{2}`, 'g'), esc(v));
  }
  out = out.replace(/\{\{[A-Z0-9_]+\}\}/g, ''); // remove leftovers
  out = out.replace(/\sstyle="[^"]*"/g, ''); // strip inline styles
  return out;
}
// tiny QA/autofix: ensure <h1>, add aria-label on .btn links
function qaAndAutofix(indexHtml: string) {
  let html = indexHtml;
  if (!/<h1[\s>]/i.test(html)) html = html.replace(/<h2(\s|>)/i, '<h1$1').replace(/<\/h2>/i, '</h1>');
  html = html.replace(/<a([^>]*class="[^"]*btn[^"]*"[^>]*)>([^<]+)<\/a>/gi, (m, attrs, text) => {
    if (/aria-label=/.test(attrs)) return m;
    const aria = ` aria-label="${esc(String(text || '').trim().replace(/\s+/g, ' '))}"`;
    return `<a${attrs}${aria}>${text}</a>`;
  });
  return html;
}
function stableStringify(o: any): string {
  if (Array.isArray(o)) return '[' + o.map(stableStringify).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
  return JSON.stringify(o);
}

router.post('/compose', async (req, res) => {
  try {
    const sections = Array.isArray(req.body?.sections) ? req.body.sections : [];
    const title = String(req.body?.title || 'Preview');
    const dark = !!req.body?.dark;
    const copy = (req.body?.copy || {}) as Record<string, string>;
    const brand = String(req.body?.brand?.primary || '');
    const tier: Tier = String(req.body?.tier || 'premium') as Tier;
    if (!sections.length) return res.status(400).json({ ok: false, error: 'no_sections' });

    const keyBrand = safeColor(brand);
    const stripJS = !!(req.body as any)?.stripJS; // include in cache key
    const payloadKey = createHash('sha1')
      .update(stableStringify({ sections, title, dark, copy, brand: keyBrand, tier, stripJS }))
      .digest('hex');
    const hit = CACHE.get(payloadKey);
    if (hit) return res.json({ ok: true, path: `/previews/forks/${hit.slug}/`, url: hit.url || `/previews/forks/${hit.slug}/` });

    const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || 'previews');
    const partsDir = path.join(PREVIEWS_DIR, 'sections');

    const htmlPieces: string[] = [];
    for (const id of sections) {
      let file = path.join(partsDir, `${id}.html`);
      if (!fs.existsSync(file)) {
        const baseId = String(id).split('@')[0];
        file = path.join(partsDir, `${baseId}.html`);
      }
      if (!fs.existsSync(file)) return res.status(400).json({ ok: false, error: `missing_section:${id}` });
      htmlPieces.push(applyCopy(fs.readFileSync(file, 'utf8'), copy));
    }

    const body = htmlPieces.join('\n\n');
    const base = wrapHTML({ title, dark, brand, tier, body });
    let html = qaAndAutofix(base);

    // --- JS stripping (optional) ---
    if (stripJS) {
      // remove all script tags
      html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      // remove inline event handlers like onclick=, onload=, etc.
      html = html.replace(/\s+on[a-z]+\s*=\s*"(?:[^"\\]|\\.)*"/gi, '');
      html = html.replace(/\s+on[a-z]+\s*=\s*'(?:[^'\\]|\\.)*'/gi, '');
    }
    // -------------------------------

    const teamId = (req as any).cookies?.teamId || (req.headers as any)['x-team-id'] || null;
    const forksDir = safeJoinTeam(teamId, '/previews/forks');
    await fs.promises.mkdir(forksDir, { recursive: true });

    const slug = `compose-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const destDir = path.join(forksDir, slug);
    await fs.promises.mkdir(destDir, { recursive: true });
    await fs.promises.writeFile(path.join(destDir, 'index.html'), html, 'utf8');

    const persisted = await persistFork({ slug, dir: destDir });
    CACHE.set(payloadKey, { slug, url: persisted.url || '' });
    return res.json({ ok: true, path: `/previews/forks/${slug}/`, url: persisted.url || `/previews/forks/${slug}/` });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'compose_failed' });
  }
});

export default router;
