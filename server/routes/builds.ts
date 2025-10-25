// server/routes/builds.ts
import { Router } from "express";
import { createBuildJob, getJob, runFakeBuild } from "../builds.ts";

const router = Router();

router.post("/previews/build", async (req, res) => {
  const slug = String((req.body && (req.body as any).slug) || "").trim();
  if (!slug) return res.status(400).json({ ok: false, error: "slug required" });

  const jobId = createBuildJob();
  // fire and forget
  runFakeBuild(jobId, slug).catch(() => {});
  return res.json({ ok: true, jobId });
});

router.get("/builds/:id", (req, res) => {
  const id = String(req.params.id || "");
  const job = getJob(id);
  if (!job) return res.status(404).json({ ok: false, error: "not found" });
  return res.json({ ok: true, job });
});

// Simple pulse for CLI polling: GET /api/builds/:id/pulse -> {pct,status}
router.get("/builds/:id/pulse", (req, res) => {
  const job = getJob(String(req.params.id || ""));
  if (!job) return res.status(404).json({ ok: false, error: "not found" });
  return res.json({ ok: true, pct: job.pct, status: job.status });
});

export default router;
