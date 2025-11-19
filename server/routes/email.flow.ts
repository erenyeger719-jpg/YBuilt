// server/routes/email.flow.ts
import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

// POST /api/flow/email/welcome
router.post("/welcome", async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim();
  const apiKey = String(req.headers["x-email-api-key"] || "").trim();
  const pageId = req.body?.pageId ? String(req.body.pageId) : null;
  const workspaceId = req.body?.workspaceId
    ? String(req.body.workspaceId)
    : null;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res
      .status(400)
      .json({ ok: false, error: "invalid_email" });
  }

  if (!apiKey) {
    return res
      .status(400)
      .json({ ok: false, error: "missing_api_key" });
  }

  try {
    // Day-1: just simulate a send.
    // Later you can plug in Resend/Postmark/etc. here.
    console.log("[flow.email] welcome", {
      email,
      pageId,
      workspaceId,
    });

    return res.json({ ok: true, sent: true });
  } catch (err) {
    console.error("[flow.email] send_failed", err);
    return res
      .status(500)
      .json({ ok: false, error: "send_failed" });
  }
});

export default router;
