import type { Request, Response, NextFunction } from "express";
import {
  drainMode,
  currentExecTier,
  execCapabilitiesForTier,
} from "../ai/router.helpers.ts";

export function execTierMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const drained = drainMode(req);
    const tier = currentExecTier(req);
    const caps = execCapabilitiesForTier(tier);

    // Attach to request so all routes can see it
    (req as any).__execTier = tier;
    (req as any).__execCaps = caps;
    (req as any).__drain = drained;

    // Basic debug/metrics headers
    res.setHeader("X-Exec-Tier", String(tier));
    res.setHeader("X-Drain-Mode", drained ? "1" : "0");

    // We don't block here; individual routes decide how to degrade.
  } catch {
    // Fail-safe: if something goes wrong, don't block the request.
  }

  next();
}
