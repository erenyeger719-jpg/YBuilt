// server/routes/execute.sandbox.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { runSandbox } from "../sandbox/index.ts";
import type { ExecRequest, ExecFile } from "../execute/types.ts";
import { logsBus } from "../logs.js";

const router = Router();

// --- tiny helpers ---
function bad(res: Response, msg: string, code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}
function safePath(p: string) {
  return /^[a-z0-9/_\-.]+$/i.test(p) && !p.includes("..");
}

// ---------- BLOCK P: Sandbox Policy V1 ----------
const ENV_MAX_MS = parseInt(process.env.SANDBOX_MAX_MS || "7000", 10);
const ENV_MAX_MB = parseInt(process.env.SANDBOX_MAX_MB || "384", 10);
const ENV_ALLOW_NET = process.env.SANDBOX_ALLOW_NET === "true"; // default off
const ENV_ALLOW_FS = process.env.SANDBOX_ALLOW_FS !== "false"; // default on (guarded by safePath)

type Policy = {
  allowNet?: boolean;
  allowFs?: boolean;
  maxMs?: number;
  maxMb?: number;
  allowPaths?: string[]; // relative safe roots
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function applyPolicy(
  req: Request,
  payload: any
): { ok: true; payload: any } | { ok: false; error: string } {
  const ip = String(
    (req as any).ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anon"
  );
  const userPol: Policy = (payload && payload.policy) || {};
  const pol: Required<Policy> = {
    allowNet: userPol.allowNet === true && ENV_ALLOW_NET,
    allowFs: (userPol.allowFs ?? true) && ENV_ALLOW_FS,
    maxMs: clamp(userPol.maxMs ?? ENV_MAX_MS, 100, ENV_MAX_MS),
    maxMb: clamp(userPol.maxMb ?? ENV_MAX_MB, 32, ENV_MAX_MB),
    allowPaths:
      Array.isArray(userPol.allowPaths) && userPol.allowPaths.length
        ? userPol.allowPaths
        : ["sandbox", "tmp", ".scratch"],
  };

  // Validate files (names only; runner enforces true FS jail)
  const files = Array.isArray(payload?.files) ? payload.files : [];
  for (const f of files) {
    const p = String(f?.path || "");
    if (!p || !safePath(p)) return { ok: false, error: "bad_path" };
    const okRoot = pol.allowPaths.some((root) => p.startsWith(root + "/") || p === root);
    if (!okRoot) return { ok: false, error: "path_not_allowed" };
  }

  // Network default OFF unless env permits and user asks
  if (payload?.opts?.net && !pol.allowNet) return { ok: false, error: "net_blocked" };
  // FS default ON (jail) but can be disabled via env
  if (!pol.allowFs && files.length) return { ok: false, error: "fs_blocked" };

  // Clamp limits the runner can read
  payload.timeoutMs = clamp(Number(payload?.timeoutMs || pol.maxMs), 100, pol.maxMs);
  payload.memoryMb = clamp(Number(payload?.memoryMb || pol.maxMb), 32, pol.maxMb);
  payload.opts = { ...(payload?.opts || {}), net: !!(payload?.opts?.net && pol.allowNet) };

  (payload.meta ??= {}).policy = { ip, ...pol };
  return { ok: true, payload };
}
// ---------- /BLOCK P ----------

// --- GET /api/execute/health ---
router.get("/health", (_req, res) => {
  const impl = process.env.RUNNER_IMPL || "local";
  res.json({
    ok: true,
    enabled: process.env.ENABLE_SANDBOX === "true",
    impl,
    maxConcurrency: parseInt(process.env.RUNNER_MAX_CONCURRENCY || "1", 10),
    // simple readiness hint for docker/podman users
    needsContainerRuntime:
      process.env.ENABLE_SANDBOX === "true" && impl.toLowerCase() === "docker",
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

  // 3) run sandbox
  try {
    // Apply policy & clamps before execution
    const pol = applyPolicy(req, body as any);
    if (!pol.ok) return res.status(400).json({ ok: false, error: pol.error });

    const out = await runSandbox(pol.payload);

    // Stream an audit row to the /logs namespace (best-effort)
    try {
      const rid = (res.getHeader("X-Request-ID") as string) || "";
      (req.app as any).get("io")?.of("/logs").emit("server:exec", {
        ts: Date.now(),
        rid,
        lang: body.lang,
        ok: out.ok,
        reason: out.reason,
        ms: out.durationMs,
        exitCode: out.exitCode ?? null,
        bytes: { code: body.code.length, files: (body.files || []).length },
      });
    } catch {}

    // NEW: JSONL audit line (picked up by logs.sink.jsonl)
    try {
      const rid = (res.getHeader("X-Request-ID") as string) || "";
      logsBus.emit("log", {
        level: "info",
        source: "exec",
        type: "sandbox",
        rid,
        method: req.method,
        path: req.path,
        status: out.ok ? 200 : 400,
        ms: out.durationMs,
        message: `exec ${body.lang} ${out.ok ? "ok" : out.reason || "fail"}`,
        extras: {
          lang: body.lang,
          ok: out.ok,
          reason: out.reason || null,
          exitCode: out.exitCode ?? null,
          sizes: { code: body.code.length, files: (body.files || []).length },
        },
      } as any);
    } catch {}

    return res.json(out);
  } catch (_e: any) {
    return res.status(500).json({ ok: false, error: "sandbox error" });
  }
});

export default router;
