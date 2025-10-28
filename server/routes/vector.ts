// server/routes/vector.ts
import { Router } from "express";
import { runVectorMiner, maybeNightlyMine } from "../media/vector.miner.ts";

const router = Router();

// POST /api/ai/vector/mine  → force a scan now
router.post("/vector/mine", (_req, res) => {
  try {
    const out = runVectorMiner(2000);
    return res.json({ ok: true, ...out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "mine_failed", message: e?.message || "mine failed" });
  }
});

// POST /api/ai/vector/maybe-nightly → scan if last run > 24h
router.post("/vector/maybe-nightly", (_req, res) => {
  try {
    const out = maybeNightlyMine();
    return res.json({ ok: true, ...out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "nightly_failed", message: e?.message || "nightly failed" });
  }
});

export default router;
