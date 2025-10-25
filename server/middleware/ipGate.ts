// server/middleware/ipGate.ts
import type { Request, Response, NextFunction } from "express";

function ipOf(req: Request) {
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  const raw =
    (xf.split(",")[0] || "").trim() ||
    req.ip ||
    ((req.socket as any).remoteAddress as string) ||
    "";
  const ip = raw.replace(/^::ffff:/, "");
  return ip === "::1" ? "127.0.0.1" : ip || "unknown";
}

export function ipGate() {
  const deny = new Set(
    (process.env.IP_DENYLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const allow = new Set(
    (process.env.IP_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const hasAllow = allow.size > 0;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = ipOf(req);

    // If an allowlist exists, only allow those IPs
    if (hasAllow && !allow.has(ip)) {
      return res
        .status(403)
        .json({ ok: false, error: "forbidden", message: "blocked by allowlist" });
    }
    // Otherwise block denies
    if (deny.has(ip)) {
      return res
        .status(403)
        .json({ ok: false, error: "forbidden", message: "blocked by denylist" });
    }
    next();
  };
}
