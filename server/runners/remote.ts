// server/runners/remote.ts
import type { RunOpts } from './docker.js';

const BASE = process.env.RUNNER_HTTP_URL || '';
const KEY  = process.env.RUNNER_HTTP_KEY || '';

export async function runRemote(opts: RunOpts) {
  if (!BASE) {
    const err: any = new Error('no_remote_runner');
    err.code = 'NO_REMOTE';
    throw err;
  }
  const r = await fetch(`${BASE.replace(/\/$/, '')}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Runner-Key': KEY,
    },
    body: JSON.stringify(opts),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err: any = new Error(`remote_failed ${r.status} ${text.slice(0,120)}`);
    err.code = 'REMOTE_FAILED';
    throw err;
  }
  return await r.json();
}

export async function remoteHealth() {
  if (!BASE) return { ok: false, driver: 'remote' as const, error: 'NO_REMOTE' };
  try {
    const r = await fetch(`${BASE.replace(/\/$/, '')}/health`, {
      headers: { 'X-Runner-Key': KEY },
    });
    if (!r.ok) return { ok: false, driver: 'remote' as const, error: `HTTP_${r.status}` };
    const data = await r.json().catch(() => ({}));
    return { ok: Boolean(data?.ok), driver: 'remote' as const };
  } catch {
    return { ok: false, driver: 'remote' as const, error: 'UNREACHABLE' };
  }
}
