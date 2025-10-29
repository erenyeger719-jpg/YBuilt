// server/routes/kpi.ts
import { Router } from "express";
import type { Request, Response } from "express";

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

/** POST /api/kpi/seen  */
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

/** POST /api/kpi/convert */
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
