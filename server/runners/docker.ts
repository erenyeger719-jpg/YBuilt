// server/runners/docker.ts
import { spawn, exec as execCb } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { makeTempDir, safeRmRF } from '../utils/tmp.js';
import { LANGS, type LangKey } from '../policy/allowlist.js';

const exec = promisify(execCb);
const DOCKER = process.env.DOCKER_BIN || 'docker';

let dockerChecked = false;
async function ensureDocker() {
  if (dockerChecked) return;
  await exec(`${DOCKER} version`).catch(() => {
    const err: any = new Error('Docker not available');
    err.code = 'NO_DOCKER';
    throw err;
  });
  dockerChecked = true;
}

async function ensureImage(image: string) {
  const ok = await exec(`${DOCKER} image inspect ${image}`).then(() => true).catch(() => false);
  if (!ok) {
    await exec(`${DOCKER} pull ${image}`);
  }
}

export type RunOpts = {
  lang: LangKey;
  code: string;
  timeoutMs?: number;   // default 3000
  memoryMB?: number;    // default 256
  cpus?: number;        // default 0.5
};

export async function runInDocker(opts: RunOpts) {
  await ensureDocker();

  const { lang, code } = opts;
  const conf = LANGS[lang];
  if (!conf) throw new Error('lang_not_allowed');

  const timeoutMs = Math.max(500, Math.min(opts.timeoutMs ?? 3000, 15000));
  const memoryMB  = Math.max(64,  Math.min(opts.memoryMB  ?? 256,   1024));
  const cpus      = Math.max(0.1, Math.min(opts.cpus      ?? 0.5,    2));

  const work = await makeTempDir();
  const file = path.join(work, conf.filename);
  await fs.promises.writeFile(file, code, 'utf8');

  // make sure the image is present (pulls once; outside container networking)
  await ensureImage(conf.image);

  const id = `ybx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

  const args = [
    'run', '--rm', '--name', id,
    '--network', 'none',
    '--ipc', 'none',
    `--cpus=${cpus}`,
    `--memory=${memoryMB}m`, '--memory-swap', `${memoryMB}m`,
    '--pids-limit', '64',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--read-only',
    '--ulimit', 'nofile=1024:1024',
    '--ulimit', 'nproc=128:128',
    '--tmpfs', '/tmp:rw,exec,size=64m',
    '-v', `${work}:/sandbox:ro`,
    '-w', '/sandbox',
    conf.image,
    ...conf.cmd,
  ];

  const child = spawn(DOCKER, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const MAX_BYTES = 200_000;
  let stdout = '';
  let stderr = '';
  let outBytes = 0;
  let truncated = false;

  const add = (src: Buffer, which: 'out' | 'err') => {
    if (truncated) return;
    outBytes += src.length;
    if (outBytes > MAX_BYTES) {
      truncated = true;
      try { child.kill('SIGKILL'); } catch {}
      return;
    }
    if (which === 'out') stdout += String(src);
    else stderr += String(src);
  };

  child.stdout.on('data', (b) => add(b, 'out'));
  child.stderr.on('data', (b) => add(b, 'err'));

  let timedOut = false;
  const timer = setTimeout(async () => {
    timedOut = true;
    try { await exec(`${DOCKER} rm -f ${id}`); } catch {}
  }, timeoutMs);

  const exitCode: number = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
  });

  clearTimeout(timer);
  await safeRmRF(work);

  return {
    ok: exitCode === 0 && !timedOut && !truncated,
    exitCode,
    timedOut,
    truncated,
    stdout,
    stderr,
    policy: {
      network: 'none',
      rootfs: 'read-only',
      tmpfs: '/tmp 64MB',
      memoryMB,
      cpus,
      pidsLimit: 64,
      ipc: 'none',
    },
  };
}

export async function runnerHealth() {
  try {
    await ensureDocker();
    return { ok: true, driver: 'docker' as const };
  } catch (e: any) {
    return { ok: false, driver: 'docker' as const, error: e?.code || 'NO_DOCKER' };
  }
}
