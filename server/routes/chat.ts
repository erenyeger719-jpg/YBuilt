// server/routes/builds.ts
import { Router } from "express";
import { createBuildJob, getJob, runFakeBuild } from "../builds.js";

const router = Router();

/**
 * POST /api/previews/build
 * body: { slug: string }
 * returns: { ok:true, jobId }
 */
router.post("/previews/build", async (req, res) => {
  const slug = String((req.body && req.body.slug) || "").trim();
  if (!slug) return res.status(400).json({ ok: false, error: "slug required" });

  const jobId = createBuildJob();
  // fire and forget
  runFakeBuild(jobId, slug).catch(() => { /* noop */ });

  return res.json({ ok: true, jobId });
});

/**
 * GET /api/builds/:id
 * returns: { ok:true, job }
 */
router.get("/builds/:id", (req, res) => {
  const id = String(req.params.id || "");
  const job = getJob(id);
  if (!job) return res.status(404).json({ ok: false, error: "not found" });
  return res.json({ ok: true, job });
});

export default router;
