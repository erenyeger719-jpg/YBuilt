import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const CACHE = new Map<string, { slug: string; url: string }>();

const router = Router();

// order-insensitive stable stringify for objects (and deterministic for arrays)
function stableStringify(o: any): string {
  if (Array.isArray(o)) return '[' + o.map(stableStringify).join(',') + ']';
  if (o && typeof o === 'object') {
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
  }
  return JSON.stringify(o);
}

// lazy import to match your existing usage pattern
const requireMod: any = (await import('module')).createRequire(import.meta.url);
const { safeJoinTeam } = requireMod('./_teamPaths');
const { persistFork } = await import('../previews.storage.ts');

function esc(s: string) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Harden brand color against CSS injection
function safeColor(input: string, fallback = '#6d28d9') {
  const s = String(input || '').trim();
  const m = s.match(/^#?[0-9a-fA-F]{3,8}$/);
  return m ? (s.startsWith('#') ? s : `#${s}`) : fallback;
}

// tiny base HTML
function wrapHTML({ title, dark, brand, body }: { title: string; dark: boolean; brand: string; body: string }) {
  const bg = dark ? '#0b0b0f' : '#ffffff';
  const fg = dark ? '#e8e8ee' : '#111111';
  const brandColor = safeColor(brand || (dark ? '#7c3aed' : '#6d28d9'));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  :root { --bg:${bg}; --fg:${fg}; --brand:${brandColor}; }
  html,body { margin:0; padding:0; background:var(--bg); color:var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 56px 20px; }
  .btn { display:inline-block; background:var(--brand); color:white; padding:10px 16px; border-radius:10px; text-decoration:none; }
  .grid { display:grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap:16px; }
  .card { background: rgba(125,125,150,0.08); border:1px solid rgba(125,125,150,0.15); padding:16px; border-radius:12px; }
  .hero .sub { opacity:0.8; }
  @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function applyCopy(html: string, copy: Record<string,string>) {
  let out = html;
  for (const [k,v] of Object.entries(copy || {})) {
    const token = new RegExp(`\\{{2}${k}\\}{2}`, 'g'); // {{KEY}}
    out = out.replace(token, esc(v));
  }
  // clean any leftover tokens
  out = out.replace(/\{\{[A-Z0-9_]+\}\}/g, '');
  return out;
}

router.post('/compose', async (req, res) => {
  try {
    const sections = Array.isArray(req.body?.sections) ? req.body.sections : [];
    const title = String(req.body?.title || 'Preview');
    const dark = Boolean(req.body?.dark || false);
    const copy = (req.body?.copy || {}) as Record<string,string>;
    const brand = String(req.body?.brand?.primary || '');

    if (!sections.length) return res.status(400).json({ ok:false, error:'no_sections' });

    // Deduplicate identical composes (order-insensitive hashing for objects)
    const keyBrand = safeColor(brand);
    const payloadKey = createHash('sha1')
      .update(stableStringify({ sections, title, dark, copy, brand: keyBrand }))
      .digest('hex');

    const hit = CACHE.get(payloadKey);
    if (hit) {
      return res.json({ ok:true, path:`/previews/forks/${hit.slug}/`, url: hit.url || `/previews/forks/${hit.slug}/` });
    }

    const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || 'previews');
    const partsDir = path.join(PREVIEWS_DIR, 'sections');

    const htmlPieces: string[] = [];
    for (const id of sections) {
      const file = path.join(partsDir, `${id}.html`);
      if (!fs.existsSync(file)) {
        return res.status(400).json({ ok:false, error:`missing_section:${id}` });
      }
      const raw = fs.readFileSync(file, 'utf8');
      htmlPieces.push(applyCopy(raw, copy));
    }

    const body = htmlPieces.join('\n\n');
    const indexHtml = wrapHTML({ title, dark, brand, body });

    // write to a team-scoped fork directory (reuses your existing storage)
    const teamId = (req as any).cookies?.teamId || (req.headers as any)['x-team-id'] || null;
    const forksDir = safeJoinTeam(teamId, '/previews/forks');
    await fs.promises.mkdir(forksDir, { recursive: true });

    const slug = `compose-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    const destDir = path.join(forksDir, slug);
    await fs.promises.mkdir(destDir, { recursive: true });
    await fs.promises.writeFile(path.join(destDir, 'index.html'), indexHtml, 'utf8');

    const persisted = await persistFork({ slug, dir: destDir });
    CACHE.set(payloadKey, { slug, url: persisted.url || '' });
    return res.json({ ok:true, path:`/previews/forks/${slug}/`, url: persisted.url || `/previews/forks/${slug}/` });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'compose_failed' });
  }
});

export default router;
