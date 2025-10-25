// remote-runner/index.ts
import express from 'express';
import cors from 'cors';
import { runnerHealth, runInDocker } from '../server/runners/docker.js';

const KEY = process.env.RUNNER_HTTP_KEY || '';
const MOCK = process.env.REMOTE_MOCK === 'true';
const PORT = Number(process.env.PORT || 6060);

const app = express();
app.use(cors());
app.use(express.json({ limit: '300kb' }));

function checkKey(req: express.Request, res: express.Response) {
  if (!KEY) return true;
  if (req.header('X-Runner-Key') === KEY) return true;
  res.status(401).json({ ok: false, error: 'unauthorized' });
  return false;
}

app.get('/health', async (req, res) => {
  if (!checkKey(req, res)) return;
  if (MOCK) return res.json({ ok: true, mode: 'mock' });
  const h = await runnerHealth();
  return res.json({ ok: h.ok, mode: 'docker', detail: h });
});

app.post('/run', async (req, res) => {
  if (!checkKey(req, res)) return;
  const { lang, code, timeoutMs, memoryMB, cpus } = req.body || {};
  if (!lang || !code) return res.status(400).json({ ok: false, error: 'missing_fields' });

  if (MOCK) {
    return res.json({
      ok: true,
      exitCode: 0,
      timedOut: false,
      truncated: false,
      stdout: '[mock] ' + (String(code).slice(0, 60)),
      stderr: '',
      policy: { mock: true },
    });
  }

  try {
    const out = await runInDocker({ lang, code, timeoutMs, memoryMB, cpus });
    return res.json(out);
  } catch (e: any) {
    const err = e?.code === 'NO_DOCKER' ? 'runner_unavailable' : 'runner_failed';
    return res.status(503).json({ ok: false, error: err });
  }
});

app.listen(PORT, () => {
  console.log(`[remote-runner] up on :${PORT} mock=${MOCK}`);
});
