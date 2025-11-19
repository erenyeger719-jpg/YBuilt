// server/mw/shadow-guard.ts
import type { Request, Response, NextFunction } from "express";

/**
 * If upstream flagged X-Shadow, short-circuit ship/publish/export/enqueue routes.
 * Safe, idempotent; returns a clear "preview_only" payload.
 */
export function shadowGuard() {
  const SHIP_RE = /(publish|export|compose|enqueue|persist|save)/i;
  return function (req: Request, res: Response, next: NextFunction) {
    const shadow =
      String(res.getHeader("X-Shadow") || "") === "1" ||
      Boolean((res.locals as any)?.shadow);

    if (!shadow) return next();

    const looksLikeShip =
  (req.method === "POST" || req.method === "GET") &&
  (SHIP_RE.test(req.path) || SHIP_RE.test(req.originalUrl || ""));

    if (!looksLikeShip) return next();

    return res.status(200).json({ ok: true, preview_only: true, reason: "shadow" });
  };
}
