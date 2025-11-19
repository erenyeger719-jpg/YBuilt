// server/routes/kpi.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { recordShip } from "../metrics/outcome.ts";

type Arm = "A" | "B";
type ExpKey = string;

type SeenEvent = {
  experiment: ExpKey;
  variant: Arm;
  path: string;
  ts: number;
};
type ConvertEvent = {
  experiment: ExpKey;
  variant: Arm;
  pageId?: string | null;
  meta?: any;
  ts: number;
};

const seen: SeenEvent[] = [];
const conv: ConvertEvent[] = [];

const router = Router();

/** utils */
function ok(res: Response, data: any = {}) {
  return res.json({ ok: true, ...data });
}
function bad(res: Response, msg = "bad_request", code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}

/** POST /api/kpi/seen  (legacy A/B views tracker kept for tests) */
router.post("/kpi/seen", (req: Request, res: Response) => {
  const { experiment, variant, path, ts } = req.body || {};
  if (!experiment || !variant) return bad(res, "missing_fields");
  if (variant !== "A" && variant !== "B") return bad(res, "invalid_variant");
  seen.push({
    experiment: String(experiment),
    variant,
    path: typeof path === "string" ? path : "/",
    ts: Number(ts || Date.now()),
  });
  return ok(res);
});

/** POST /api/kpi/convert (legacy A/B conversions tracker kept for tests) */
router.post("/kpi/convert", (req: Request, res: Response) => {
  const { experiment, variant, pageId, meta } = req.body || {};
  if (!experiment || !variant) return bad(res, "missing_fields");
  if (variant !== "A" && variant !== "B") return bad(res, "invalid_variant");
  conv.push({
    experiment: String(experiment),
    variant,
    pageId: pageId ?? null,
    meta: meta ?? null,
    ts: Date.now(),
  });
  return ok(res);
});

// POST /api/seen – record a generic "view" / impression via metrics brain
router.post("/seen", (req: Request, res: Response) => {
  const body: any = (req as any).body || {};
  const rawUrl: string | undefined =
    typeof body.url === "string" ? body.url : undefined;

  let pageId: string | null =
    typeof body.pageId === "string" ? body.pageId : null;
  const workspaceId: string | null =
    typeof body.workspaceId === "string" ? body.workspaceId : null;

  if (!rawUrl && !pageId) {
    return res.status(400).json({
      ok: false,
      error: "missing_page_or_url",
    });
  }

  let exp: string | null = null;
  let arm: string | null = null;
  let urlForMetrics: string | null = rawUrl || null;

  try {
    if (rawUrl) {
      const u = new URL(rawUrl);

      // pull ?__exp=...&__arm=...
      exp = u.searchParams.get("__exp");
      arm = u.searchParams.get("__arm");

      // try to infer pg_* id from the path if pageId is missing
      if (!pageId) {
        const m = u.pathname.match(/(pg_[A-Za-z0-9_-]+)/);
        if (m) pageId = m[1];
      }
    }
  } catch (err) {
    // Bad URL string – log and fall back to pageId-only metrics
    console.error("[kpi.seen] failed to parse url", err);
  }

  try {
    recordShip({
      pageId: pageId || undefined,
      url: urlForMetrics || undefined,
      workspaceId: workspaceId || undefined,
      exp: exp || undefined,
      arm: arm || undefined,
      kind: "seen", // mark this as a view / impression
    });
  } catch (err) {
    // Never crash the client if metrics storage has issues
    console.error("[kpi.seen] failed to record view", err);
  }

  return res.json({ ok: true });
});

/** GET /api/metrics?experiment=exp_name */
router.get("/metrics", (req: Request, res: Response) => {
  const exp = String(req.query.experiment || "").trim();
  if (!exp) return ok(res, { experiments: {} });

  const viewsA = seen.filter((e) => e.experiment === exp && e.variant === "A").length;
  const viewsB = seen.filter((e) => e.experiment === exp && e.variant === "B").length;
  const convA = conv.filter((e) => e.experiment === exp && e.variant === "A").length;
  const convB = conv.filter((e) => e.experiment === exp && e.variant === "B").length;

  return ok(res, {
    experiments: {
      [exp]: {
        A: { views: viewsA, conv: convA },
        B: { views: viewsB, conv: convB },
      },
    },
  });
});

export default router;
