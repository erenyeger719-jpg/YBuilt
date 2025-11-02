// server/routes/ux.patch.ts
import { Router } from "express";
import * as crypto from "node:crypto";
import { buildRhythmCSS } from "../ux/rhythm.ts";

const router = Router();

// POST /api/ux/patch
// body: { lqr?, cls_est?, lcp_est_ms?, density?, base_px?, max_ch?, container_px? }
router.post("/patch", (req, res) => {
  try {
    const hints = req.body || {};

    const { css, meta } = buildRhythmCSS({
      lqr: typeof hints.lqr === "number" ? hints.lqr : null,
      cls_est: typeof hints.cls_est === "number" ? hints.cls_est : null,
      lcp_est_ms: typeof hints.lcp_est_ms === "number" ? hints.lcp_est_ms : null,
      density: ["dense", "normal", "airy"].includes(hints.density) ? hints.density : undefined,
      base_px: typeof hints.base_px === "number" ? hints.base_px : undefined,
      max_ch: typeof hints.max_ch === "number" ? hints.max_ch : undefined,
      container_px: typeof hints.container_px === "number" ? hints.container_px : undefined,
    });

    // Hash the CSS for Proof Card chains / integrity checks
    const hash = crypto.createHash("sha256").update(css).digest("hex");

    // Response headers for client tooling
    res.setHeader("X-UX-Patch", "rhythm-css-v1");
    res.setHeader("X-Content-Hash", hash);

    // Clients can inline <style> or write to a file; meta helps render a proof card.
    return res.json({ ok: true, css, meta, hash });
  } catch {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
