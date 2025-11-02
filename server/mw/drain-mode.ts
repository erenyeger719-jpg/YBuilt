// server/mw/drain-mode.ts
import type { Request, Response, NextFunction } from "express";

let DRAIN = /^(1|true|on)$/i.test(String(process.env.SUP_DRAIN || ""));

export function isDrainOn() {
  return DRAIN;
}
export function setDrain(on: boolean) {
  DRAIN = !!on;
}

export function drainMode() {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!DRAIN) return next();

    // Advertise drain globally; apply safe degradations.
    (_req.headers as any)["x-drain"] = "1";
    res.setHeader("X-Drain", "1");

    const existing = String(res.getHeader("X-Degrade") || "");
    const add = ["no-js", "neutralize-claims", "shadow"];
    const merged = Array.from(
      new Set((existing ? existing.split(",") : []).concat(add))
    )
      .filter(Boolean)
      .join(",");

    if (merged) res.setHeader("X-Degrade", merged);
    next();
  };
}
