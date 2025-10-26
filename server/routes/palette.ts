// server/routes/palette.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { createBuildJob, runFakeBuild } from "../builds.ts";
import { runSandbox } from "../sandbox/index.ts";
import type { ExecRequest } from "../execute/types.ts";
import { logEvent } from "../logs.js";
import { logsBus } from "../logs.js";

const router = Router();

// Small catalog (add more later)
const COMMANDS = [
  { id: "previews.build", title: "Build preview (fake pipeline)", params: [{ name: "slug", req: true }] },
  { id: "execute.run", title: "Run code in sandbox", params: [{ name: "lang", req: true }, { name: "code", req: true }] },
];

// GET /api/palette/commands
router.get("/commands", (_req, res) => {
  res.json({ ok: true, items: COMMANDS });
});

// POST /api/palette/run { id, args:{} }
router.post("/run", async (req: Request, res: Response) => {
  const id = String((req.body?.id || "")).trim();
  const args = (req.body?.args || {}) as Record<string, any>;

  const rid =
    ((res.getHeader("X-Request-ID") as string) ||
      (req.headers["x-request-id"] as string) ||
      "") + "";
  const t0 = Date.now();

  function emitAudit({
    level,
    status,
    message,
    extras,
  }: {
    level: "info" | "warn" | "error";
    status: number;
    message: string;
    extras?: Record<string, any>;
  }) {
    try {
      logsBus.emit("log", {
        level,
        source: "palette",
        type: "command",
        rid,
        method: "POST",
        path: "/api/palette/run",
        status,
        ms: Date.now() - t0,
        message,
        extras: { id, args, ...(extras || {}) },
      });
    } catch {}
  }

  try {
    switch (id) {
      case "previews.build": {
        const slug = String(args.slug || "").trim();
        if (!slug) {
          emitAudit({
            level: "warn",
            status: 400,
            message: "palette.run previews.build fail (slug required)",
          });
          return res.status(400).json({ ok: false, error: "slug required" });
        }

        const jobId = createBuildJob();
        // fire & forget
        runFakeBuild(jobId, slug).catch(() => {});
        // socket audit (kept)
        logEvent(req.app.get("io"), {
          ts: Date.now(),
          source: "server",
          type: "palette:run",
          level: "info",
          rid,
          message: "previews.build",
          extras: { jobId, slug },
        });
        // bus audit
        emitAudit({
          level: "info",
          status: 200,
          message: "palette.run previews.build ok",
          extras: { jobId, slug },
        });

        return res.json({ ok: true, jobId });
      }

      case "execute.run": {
        if (process.env.ENABLE_SANDBOX !== "true") {
          emitAudit({
            level: "warn",
            status: 501,
            message: "palette.run execute.run disabled",
          });
          return res.status(501).json({ ok: false, error: "sandbox disabled" });
        }

        const body: ExecRequest = {
          lang: args.lang,
          code: String(args.code || ""),
          args: Array.isArray(args.args) ? args.args : undefined,
          files: Array.isArray(args.files) ? args.files : undefined,
          timeoutMs: Number(args.timeoutMs ?? 1500),
        };

        const out = await runSandbox(body);

        // socket audit (kept)
        logEvent(req.app.get("io"), {
          ts: Date.now(),
          source: "server",
          type: "palette:run",
          level: out.ok ? "info" : "error",
          rid,
          message: "execute.run",
          extras: { ok: out.ok, reason: out.reason, ms: out.durationMs },
        });

        // bus audit
        emitAudit({
          level: out.ok ? "info" : "warn",
          status: 200, // endpoint returns 200 with result payload
          message: `palette.run execute.run ${out.ok ? "ok" : "fail"}`,
          extras: {
            ok: out.ok,
            reason: out.reason,
            ms: out.durationMs,
            exitCode: out.exitCode ?? null,
          },
        });

        return res.json({ ok: true, result: out });
      }
    }

    emitAudit({
      level: "warn",
      status: 404,
      message: "palette.run unknown command",
    });
    return res.status(404).json({ ok: false, error: "unknown command" });
  } catch (e: any) {
    // socket audit (kept)
    logEvent(req.app.get("io"), {
      ts: Date.now(),
      source: "server",
      type: "palette:run",
      level: "error",
      rid,
      message: `command error: ${id}`,
      extras: { err: String(e?.message || e) },
    });
    // bus audit
    emitAudit({
      level: "error",
      status: 500,
      message: `palette.run ${id || "(none)"} error`,
      extras: { err: String(e?.message || e) },
    });
    return res.status(500).json({ ok: false, error: "command failed" });
  }
});

export default router;
