// server/mw/failsafe.ts
import type { Request, Response, NextFunction } from "express";

/**
 * Last-in error handler: never emit 5xx.
 * Ships a safe JSON fallback instead of blowing up.
 */
export function never500() {
  // Error-handling middleware requires 4 args
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function (err: any, req: Request, res: Response, _next: NextFunction) {
    try {
      if (res.headersSent) return;
      res.status(200).json({
        ok: false,
        error: "safe_fallback",
        message: "Degraded safely",
      });
    } catch {
      try {
        res.status(200).json({ ok: false, error: "safe_fallback" });
      } catch {
        // swallow
      }
    }
  };
}
