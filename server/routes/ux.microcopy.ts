// server/routes/ux.microcopy.ts
import { Router } from "express";
import { guardMicrocopy } from "../ux/microcopy.guard.ts";

const router = Router();

// POST /api/ux/microcopy/guard
// body: { copy: {...}, viewport?: "mobile"|"tablet"|"desktop", locale?, target_grade?, enforce? }
router.post("/microcopy/guard", (req, res) => {
  try {
    const b = req.body || {};
    const { ok, issues, patched, meta } = guardMicrocopy(b.copy || {}, {
      viewport: b.viewport,
      locale: b.locale,
      target_grade: typeof b.target_grade === "number" ? b.target_grade : undefined,
      enforce: !!b.enforce,
    });
    res.setHeader("X-UX-Guard", "microcopy-v1");
    return res.json({ ok, issues, patched, meta });
  } catch {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
