// server/routes/abuse.ts
import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const LOG = path.resolve("./data/abuse.log");

// POST /api/abuse/report
router.post("/report", (req, res) => {
  try {
    const { reason, where, meta } = req.body || {};
    const clean = {
      ts: new Date().toISOString(),
      ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip,
      reason: String(reason || "").slice(0, 500),
      where: String(where || "").slice(0, 200),
      meta: typeof meta === "object" ? meta : undefined,
    };
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify(clean) + "\n");
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// GET /api/abuse/recent?limit=100  (DEV/ops use)
router.get("/recent", (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "100"), 10) || 100, 1), 500);
    if (!fs.existsSync(LOG)) return res.json({ ok: true, items: [] });

    const raw = fs.readFileSync(LOG, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const last = lines.slice(-limit).map((l) => JSON.parse(l));
    return res.json({ ok: true, items: last });
  } catch {
    return res.status(500).json({ ok: false, error: "read_failed" });
  }
});

export default router;
