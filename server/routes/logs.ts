// server/routes/logs.ts
import { Router } from "express";
import { recentLogs, findByRequestId } from "../logs.js";

const router = Router();

// GET /api/logs/recent?limit=100&level=error&type=http:done&path=/api&rid=abc123
router.get("/recent", (req, res) => {
  const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit || "100"), 10) || 100));
  const qLevel = (String(req.query.level || "").trim().toLowerCase()) || "";
  const qType = String(req.query.type || "").trim().toLowerCase();
  const qPath = String(req.query.path || "").trim();
  const qRid = String(req.query.rid || "").trim();

  let items = recentLogs(limit * 3).reverse(); // get extra then filter down

  if (qLevel) items = items.filter((r: any) => (r.level || "").toLowerCase() === qLevel);
  if (qType) items = items.filter((r: any) => (r.type || "").toLowerCase() === qType);
  if (qPath) items = items.filter((r: any) => (r.path || "").includes(qPath));
  if (qRid) items = items.filter((r: any) => (r.rid || r.reqId || r.requestId) === qRid);

  items = items.slice(0, limit);
  return res.json({ ok: true, items });
});

// GET /api/logs/req/:rid  → all history rows for a specific request id
router.get("/req/:rid", (req, res) => {
  const rid = String(req.params.rid || "");
  const items = findByRequestId(rid).slice(-200).reverse();
  return res.json({ ok: true, items });
});

export default router;
