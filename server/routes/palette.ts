// server/routes/palette.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { createBuildJob, runFakeBuild } from "../builds.ts";
import { runSandbox } from "../sandbox/index.ts";
import type { ExecRequest } from "../execute/types.ts";
import { logEvent } from "../logs.js";

const router = Router();

// Small catalog (add more later)
const COMMANDS = [
  { id: "previews.build", title: "Build preview (fake pipeline)", params: [{name:"slug", req:true}] },
  { id: "execute.run",    title: "Run code in sandbox",          params: [{name:"lang", req:true},{name:"code", req:true}] },
];

// GET /api/palette/commands
router.get("/commands", (_req, res) => {
  res.json({ ok: true, items: COMMANDS });
});

// POST /api/palette/run { id, args:{} }
router.post("/run", async (req: Request, res: Response) => {
  const id = String((req.body?.id || "")).trim();
  const args = (req.body?.args || {}) as Record<string, any>;

  const rid = (res.getHeader("X-Request-ID") as string) || "";

  try {
    switch (id) {
      case "previews.build": {
        const slug = String(args.slug || "").trim();
        if (!slug) return res.status(400).json({ ok: false, error: "slug required" });
        const jobId = createBuildJob();
        // fire & forget
        runFakeBuild(jobId, slug).catch(() => {});
        // audit
        logEvent(req.app.get("io"), {
          ts: Date.now(), source: "server", type: "palette:run", level: "info",
          rid, message: "previews.build", extras: { jobId, slug }
        });
        return res.json({ ok: true, jobId });
      }

      case "execute.run": {
        if (process.env.ENABLE_SANDBOX !== "true") {
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
        // audit
        logEvent(req.app.get("io"), {
          ts: Date.now(), source: "server", type: "palette:run", level: out.ok ? "info" : "error",
          rid, message: "execute.run", extras: { ok: out.ok, reason: out.reason, ms: out.durationMs }
        });
        return res.json({ ok: true, result: out });
      }
    }

    return res.status(404).json({ ok: false, error: "unknown command" });
  } catch (e) {
    logEvent(req.app.get("io"), {
      ts: Date.now(), source: "server", type: "palette:run", level: "error",
      rid, message: `command error: ${id}`
    });
    return res.status(500).json({ ok: false, error: "command failed" });
  }
});

export default router;
