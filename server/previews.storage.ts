// server/previews.storage.ts
import fs from 'fs';
import path from 'path';

type PersistArgs = { slug: string; dir: string };

function guessContentType(fp: string) {
  const ext = path.extname(fp).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.txt' || ext === '.md') return 'text/plain; charset=utf-8';
  return undefined;
}

function isS3Enabled() {
  const backend = (process.env.PREVIEWS_BACKEND || '').toLowerCase();
  return backend === 's3' && !!process.env.PREVIEWS_BUCKET;
}

/** Upload the fork dir to S3 if configured. Returns a public URL either way. */
export async function persistFork({ slug, dir }: PersistArgs): Promise<{ url: string }> {
  // Disk fallback (works locally and anywhere without S3 config)
  const localUrl = `/previews/forks/${slug}/`;
  if (!isS3Enabled()) return { url: localUrl };

  // Lazy import SDK so it’s optional in dev
  let sdk: any;
  try {
    sdk = await import('@aws-sdk/client-s3');
  } catch {
    // SDK not installed -> just return the local URL
    return { url: localUrl };
  }

  const bucket = String(process.env.PREVIEWS_BUCKET);
  const region = process.env.AWS_REGION || 'us-east-1';
  const { S3Client, PutObjectCommand } = sdk;
  const s3 = new S3Client({ region });

  async function uploadFile(fp: string) {
    const rel = path.relative(dir, fp).replace(/\\/g, '/');
    const Key = `previews/${slug}/${rel}`;
    const Body = await fs.promises.readFile(fp);
    const ContentType = guessContentType(fp);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key,
        Body,
        ...(ContentType ? { ContentType } : {}),
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  }

  async function walk(p: string) {
    const entries = await fs.promises.readdir(p, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) await uploadFile(full);
    }
  }

  await walk(dir);

  const cdn = (process.env.PREVIEWS_CDN_BASE || '').replace(/\/+$/, '');
  const s3Url = cdn
    ? `${cdn}/previews/${slug}/`
    : `https://${bucket}.s3.${region}.amazonaws.com/previews/${slug}/`;

  return { url: s3Url };
}
