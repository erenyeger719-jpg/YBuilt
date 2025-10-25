// server/utils/tmp.ts
import fs from 'fs';
import os from 'os';
import path from 'path';

export async function makeTempDir(prefix = 'yb-run-') {
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
  return base;
}

export async function safeRmRF(dir: string) {
  try { await fs.promises.rm(dir, { recursive: true, force: true }); } catch {}
}
