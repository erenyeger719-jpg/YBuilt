// server/routes/logs.ts
import { Router } from "express";
import { recentLogs, findByRequestId } from "../logs.js";

const router = Router();

// GET /api/logs/recent?limit=100
router.get("/recent", (req, res) => {
  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit || "100"), 10) || 100, 1),
    500
  );
  return res.json({ ok: true, items: recentLogs(limit) });
});

// GET /api/logs/by-id/:id
router.get("/by-id/:id", (req, res) => {
  const id = String(req.params.id || "");
  return res.json({ ok: true, items: findByRequestId(id) });
});

export default router;
