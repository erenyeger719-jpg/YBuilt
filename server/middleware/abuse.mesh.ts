// server/middleware/abuse.mesh.ts
import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";

type AbuseEntry = {
  at: string;
  ip: string;
  ua: string;
  path: string;
  reasons: string[];
};

// Workspace extraction helper (multi-tenant hint)
function workspaceIdFrom(req: Request): string {
  const raw = req.headers["x-workspace-id"];
  if (!raw) return "";
  if (Array.isArray(raw)) return (raw[0] || "").toString().trim();
  return raw.toString().trim();
}

// Very simple prompt-based abuse detector.
// We can make this smarter later; keep it explicit & deterministic for now.
function detectAbuse(req: Request): string[] {
  const reasons: string[] = [];
  const body: any = req.body || {};
  const prompt = String(body.prompt || body.goal || body.text || "").toLowerCase();

  if (!prompt) return reasons;

  const badPhrases = [
    "pump and dump",
    "free money",
    "guaranteed profit",
    "1000% return",
  ];

  for (const phrase of badPhrases) {
    if (prompt.includes(phrase)) {
      reasons.push("sketchy_prompt");
      break;
    }
  }

  return reasons;
}

function writeAbuseLog(entry: AbuseEntry) {
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(".cache", "abuse");

  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore mkdir errors
  }

  const file = path.join(dir, `mesh-${day}.jsonl`);
  const line = JSON.stringify(entry) + "\n";

  try {
    fs.appendFileSync(file, line);
  } catch {
    // ignore write errors
  }
}

// Exported middleware factory
export function abuseMesh() {
  return function abuseMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const reasons = detectAbuse(req);

      if (!reasons.length) {
        return next();
      }

      const ip = String(
        (req.headers["x-forwarded-for"] as string) ||
          (req.ip as string) ||
          "unknown"
      )
        .split(",")[0]
        .trim();

      const ua = String(req.headers["user-agent"] || "");

      const entry: AbuseEntry = {
        at: new Date().toISOString(),
        ip,
        ua,
        path: req.path || "",
        reasons,
      };

      const workspaceId = workspaceIdFrom(req);
      if (workspaceId) {
        (entry as any).workspaceId = workspaceId;
      }

      // Attach to locals for future decisions / logging
      (res.locals as any).abuse = { reasons };

      // Surface the reasons as a header (useful for debugging / metrics)
      try {
        res.setHeader("X-Abuse-Reasons", reasons.join(","));
      } catch {
        // ignore header failures
      }

      // Fire-and-forget audit log
      writeAbuseLog(entry);
    } catch {
      // swallow detection/logging errors; never 500
    }

    return next();
  };
}
