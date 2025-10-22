// server/routes/deploy.queue.js
import express from "express";
import PQueue from "p-queue";
import { v4 as uuid } from "uuid";

const router = express.Router();
const jobs = new Map();
const queue = new PQueue({ concurrency: 2 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

router.post("/enqueue", express.json(), async (req, res) => {
  const { provider, previewPath, siteName } = req.body || {};
  if (!provider || !previewPath) return res.status(400).json({ error: "bad args" });

  const id = uuid();
  const job = { id, provider, previewPath, siteName, status: "queued", createdAt: Date.now() };
  jobs.set(id, job);

  queue.add(async () => {
    const j = jobs.get(id); if (!j) return;
    j.status = "running";
    try {
      // --- FAKE DEPLOY for smoke test ---
      await sleep(3000); // simulate deploy time
      j.status = "success";
      j.result = { url: `${j.previewPath}?live=${Date.now()}` };
      // ----------------------------------
      // later: call real deployers and set j.result to live URL
    } catch (e) {
      j.status = "error";
      j.error = e?.message || String(e);
    }
  });

  res.json({ ok: true, id, position: queue.size });
});

router.get("/job/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: "not found" });
  res.json({ ok: true, ...j });
});

export default router;
