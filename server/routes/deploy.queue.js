// server/routes/deploy.queue.js
import express from "express";
import PQueue from "p-queue";
import { v4 as uuid } from "uuid";
// import { deployNetlifyServer, deployVercelServer } from "../lib/deployers.js"; // your existing server deploy funcs

const router = express.Router();
const jobs = new Map();
const queue = new PQueue({ concurrency: 2 });

// Soft per-IP limit
const perIp = new Map(); // ip -> count
const MAX_QUEUED_PER_IP = 3;

router.post("/enqueue", express.json(), async (req, res) => {
  const { provider, previewPath, siteName } = req.body || {};
  if (!provider || !previewPath) return res.status(400).json({ error: "bad args" });

  // Per-IP throttling
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const count = perIp.get(ip) || 0;
  if (count >= MAX_QUEUED_PER_IP) return res.status(429).json({ error: "too many queued" });
  perIp.set(ip, count + 1);

  const id = uuid();
  const job = { id, provider, previewPath, siteName, status: "queued", createdAt: Date.now() };
  jobs.set(id, job);

  // Queue task
  queue.add(async () => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "running";

    const timeoutMs = 7 * 60 * 1000; // 7 minutes
    const start = Date.now();

    try {
      // 🧪 Fake deploy work: wait 4s, pretend we got a live URL back.
      await new Promise((r) => setTimeout(r, 4000));

      if (Date.now() - start > timeoutMs) throw new Error("timeout");

      // If wiring real providers later, call your server deploy functions here:
      // let result;
      // if (provider === "netlify") result = await deployNetlifyServer(previewPath, siteName);
      // if (provider === "vercel")  result = await deployVercelServer(previewPath, siteName);

      j.status = "success";
      j.result = { url: `${j.previewPath}?live=${Date.now()}` };
    } catch (e) {
      j.status = "error";
      j.error = e?.message || String(e);
    } finally {
      const c = perIp.get(ip) || 1;
      perIp.set(ip, Math.max(0, c - 1));
    }
  });

  res.json({ ok: true, id, position: queue.size }); // position is best-effort
});

router.get("/job/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: "not found" });
  res.json({ ok: true, ...j });
});

export default router;
