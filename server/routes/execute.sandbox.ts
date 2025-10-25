// server/routes/execute.sandbox.ts
import { Router } from 'express';
import { runInDocker, runnerHealth } from '../runners/docker.js';
import { runRemote, remoteHealth } from '../runners/remote.js';
import type { LangKey } from '../policy/allowlist.js';

const router = Router();

const useRemote = Boolean(process.env.RUNNER_HTTP_URL);

// GET /api/execute/health
router.get('/health', async (_req, res) => {
  const local = await runnerHealth();
  const remote = await remoteHealth();
  const mode = useRemote ? 'remote' : 'docker';
  const ready = useRemote ? remote.ok : local.ok;
  return res.json({ ok: ready, mode, local, remote });
});

// POST /api/execute/run
router.post('/run', async (req, res) => {
  try {
    const lang = String(req.body?.lang || '').toLowerCase() as LangKey;
    const code = String(req.body?.code || '');

    if (!lang || !code) return res.status(400).json({ ok: false, error: 'missing_fields' });
    if (!['node', 'python'].includes(lang)) {
      return res.status(400).json({ ok: false, error: 'lang_not_allowed' });
    }
    if (code.length > 100_000) {
      return res.status(413).json({ ok: false, error: 'code_too_large' });
    }

    const run = useRemote ? runRemote : runInDocker;
    const result = await run({
      lang,
      code,
      timeoutMs: Number(req.body?.timeoutMs ?? 3000),
      memoryMB:  Number(req.body?.memoryMB  ?? 256),
      cpus:      Number(req.body?.cpus      ?? 0.5),
    });

    return res.json(result);
  } catch (e: any) {
    if (e?.code === 'NO_DOCKER' || e?.code === 'NO_REMOTE') {
      return res.status(503).json({ ok: false, error: 'runner_unavailable' });
    }
    return res.status(500).json({ ok: false, error: 'runner_failed' });
  }
});

export default router;
