// server/routes/palette.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { createBuildJob, runFakeBuild } from "../builds.ts";
import { runSandbox } from "../sandbox/index.ts";
import type { ExecRequest } from "../execute/types.ts";
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

  function audit(level: "info" | "warn" | "error", status: number, message: string, extras?: Record<string, any>) {
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
          audit("warn", 400, "palette.run previews.build fail (slug required)");
          return res.status(400).json({ ok: false, error: "slug required" });
        }

        const jobId = createBuildJob();
        // fire & forget fake build
        runFakeBuild(jobId, slug).catch(() => {});

        audit("info", 200, "palette.run previews.build ok", { jobId, slug });
        return res.json({ ok: true, jobId });
      }

      case "execute.run": {
        if (process.env.ENABLE_SANDBOX !== "true") {
          audit("warn", 501, "palette.run execute.run disabled");
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

        audit(out.ok ? "info" : "warn", 200, `palette.run execute.run ${out.ok ? "ok" : "fail"}`, {
          ok: out.ok,
          reason: out.reason,
          ms: out.durationMs,
          exitCode: out.exitCode ?? null,
        });

        return res.json({ ok: true, result: out });
      }
    }

    audit("warn", 404, "palette.run unknown command");
    return res.status(404).json({ ok: false, error: "unknown command" });
  } catch (e: any) {
    audit("error", 500, `palette.run ${id || "(none)"} error`, { err: String(e?.message || e) });
    return res.status(500).json({ ok: false, error: "command failed" });
  }
});

export default router;
