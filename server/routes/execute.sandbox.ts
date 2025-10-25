// server/routes/execute.sandbox.ts
import { Router } from 'express';
import { runInDocker } from '../runners/docker.js';
import type { LangKey } from '../policy/allowlist.js';

const router = Router();

// POST /api/execute/run  { lang: "node"|"python", code: "..." }
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

    const result = await runInDocker({
      lang,
      code,
      timeoutMs: Number(req.body?.timeoutMs ?? 3000),
      memoryMB:  Number(req.body?.memoryMB  ?? 256),
      cpus:      Number(req.body?.cpus      ?? 0.5),
    });

    return res.json(result);
  } catch (e: any) {
    if (e?.code === 'NO_DOCKER') {
      return res.status(503).json({ ok: false, error: 'runner_unavailable', hint: 'Install/enable Docker' });
    }
    return res.status(500).json({ ok: false, error: 'runner_failed' });
  }
});

export default router;
