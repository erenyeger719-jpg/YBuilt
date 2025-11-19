// server/routes/flow.email.ts
import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

// Tiny helper – very basic email check
function isValidEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return false;
  // Simple pattern, good enough for our backend guard
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(trimmed);
}

/**
 * Core handler for:
 * POST /api/flow/email/welcome
 *
 * Expects:
 * - Header:  x-email-api-key  (ephemeral secret from securePrompt)
 * - Body:    { email: string, pageId?: string | null, meta?: any }
 *
 * Behavior:
 * - Never logs or stores the API key.
 * - Validates email shape.
 * - If EMAIL_WELCOME_ENDPOINT / EMAIL_WELCOME_FROM are configured:
 *     calls the external email endpoint with the API key.
 * - If not configured:
 *     just logs a sanitized event and returns { ok: true, stub: true } so
 *     Autopilot flows can still "succeed" in dev.
 */
export async function handleWelcome(req: Request, res: Response) {
  const rawKey = req.headers["x-email-api-key"];
  const apiKey =
    typeof rawKey === "string"
      ? rawKey.trim()
      : Array.isArray(rawKey)
      ? rawKey[0]?.trim()
      : "";

  if (!apiKey) {
    return res.status(400).json({
      ok: false,
      error: "missing_api_key",
    });
  }

  const body = req.body || {};
  const email = body.email;
  const pageId = typeof body.pageId === "string" ? body.pageId : null;
  const meta = body.meta ?? null;

  if (!isValidEmail(email)) {
    return res.status(400).json({
      ok: false,
      error: "invalid_email",
    });
  }

  const to = email.trim().toLowerCase();

  // Config via env – so you can plug in any provider later
  const endpoint = process.env.EMAIL_WELCOME_ENDPOINT || "";
  const from = process.env.EMAIL_WELCOME_FROM || "";

  // If email infra is not wired yet, behave like the minimal stub:
  // log a sanitized event and pretend success.
  if (!endpoint || !from) {
    console.log("[flow.email] welcome (stub)", {
      to,
      pageId,
      meta,
      configured: false,
    });

    return res.json({
      ok: true,
      stub: true,
      warning: "email_not_configured",
    });
  }

  // Very simple welcome payload – provider-specific mapping can live behind this
  const payload = {
    to,
    from,
    subject: "Welcome!",
    text: "Thanks for signing up — you’re in.",
    pageId,
    meta,
  };

  // Sanitized log – never log apiKey or provider internals
  console.log("[flow.email] welcome", {
    to,
    pageId,
    meta,
    configured: true,
  });

  try {
    // Node 20+ has global fetch; no import needed.
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Forward the ephemeral key, but NEVER log it.
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      // Do not leak any provider error details that might contain secrets.
      return res.status(502).json({
        ok: false,
        error: "email_send_failed",
        status: resp.status,
      });
    }

    return res.json({ ok: true });
  } catch {
    // Network or provider crash – still no secrets leaked
    return res.status(502).json({
      ok: false,
      error: "email_send_failed",
    });
  }
}

// Wire handler into the router
router.post("/welcome", handleWelcome);

export default router;
