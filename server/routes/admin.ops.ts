// server/routes/admin.ops.ts
import { Router } from "express";
import { isDrainOn, setDrain } from "../mw/drain-mode.ts";

const router = Router();

function authed(req: any) {
  const tok = String(req.headers["x-admin-token"] || "");
  const need = String(process.env.ADMIN_TOKEN || "dev-admin");
  return need && tok === need;
}

// GET /api/admin/drain  -> { ok, drain: boolean }
router.get("/drain", (req, res) => {
  if (!authed(req)) return res.status(403).json({ ok: false, error: "forbidden" });
  return res.json({ ok: true, drain: isDrainOn() });
});

// POST /api/admin/drain { on: true|false } -> { ok, drain }
router.post("/drain", (req, res) => {
  if (!authed(req)) return res.status(403).json({ ok: false, error: "forbidden" });
  const v = String((req.body?.on ?? req.body?.enable ?? "")).toLowerCase();
  const on = ["1", "true", "yes", "on", "enable", "enabled"].includes(v);
  setDrain(on);
  return res.json({ ok: true, drain: isDrainOn() });
});

export default router;
