import { Router } from "express";
import type { Request, Response } from "express";
import { runLocalSandbox } from "../sandbox/local.ts";
import type { ExecRequest, ExecFile } from "../execute/types.ts";

const router = Router();

// --- tiny helpers ---
function bad(res: Response, msg: string, code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}
function safePath(p: string) {
  return /^[a-z0-9/_\-.]+$/i.test(p) && !p.includes("..");
}

// --- GET /api/execute/health ---
router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    enabled: process.env.ENABLE_SANDBOX === "true",
    maxConcurrency: parseInt(process.env.RUNNER_MAX_CONCURRENCY || "1", 10),
  });
});

// --- POST /api/execute/run ---
router.post("/run", async (req: Request, res: Response) => {
  const body = (req.body || {}) as ExecRequest;

  // 1) shape validation
  if (!body || typeof body !== "object") return bad(res, "invalid payload");
  if (body.lang !== "node" && body.lang !== "python") return bad(res, "unsupported lang");

  if (typeof body.code !== "string" || body.code.trim().length === 0)
    return bad(res, "code required");
  if (body.code.length > 8 * 1024) return bad(res, "code too large (>8KB)");

  // args
  if (body.args && !Array.isArray(body.args)) return bad(res, "args must be array");
  if (Array.isArray(body.args) && body.args.some((a) => typeof a !== "string"))
    return bad(res, "args must be string[]");

  // files constraints
  let total = 0;
  if (body.files) {
    if (!Array.isArray(body.files)) return bad(res, "files must be array");
    for (const f of body.files as ExecFile[]) {
      if (!f || typeof f !== "object") return bad(res, "bad file");
      if (!f.path || typeof f.path !== "string" || !safePath(f.path))
        return bad(res, "bad file path");
      if (typeof f.content !== "string") return bad(res, "bad file content");
      total += f.content.length;
      if (f.content.length > 100 * 1024) return bad(res, "file too large (>100KB)");
    }
    if (total > 200 * 1024) return bad(res, "total files too large (>200KB)");
  }

  // clamp timeout
  const t = Math.max(100, Math.min(Number(body.timeoutMs ?? 1500), 10_000));
  body.timeoutMs = t;

  // 2) gate by flag (safe-by-default)
  if (process.env.ENABLE_SANDBOX !== "true") {
    return res.status(501).json({
      ok: false,
      reason: "compute not enabled in this environment",
    });
  }

  // 3) run stubbed sandbox (no real exec yet)
  try {
    const out = await runLocalSandbox(body);
    return res.json(out);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "sandbox error" });
  }
});

export default router;
