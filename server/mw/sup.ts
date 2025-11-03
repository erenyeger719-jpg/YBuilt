// server/mw/sup.ts
import type { Request, Response, NextFunction } from "express";
import {
  computeRiskVector,
  supDecide,
  POLICY_VERSION,
  type RiskVector,
} from "../sup/policy.core";
import { pickFailureFallback } from "../qa/failure.playbook.ts";

type SupDecision = {
  mode: string;
  reasons: string[];
};

export function supGuard(area: string) {
  return function supMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    let risk: RiskVector | null = null;
    let decision: SupDecision;

    try {
      const body: any = req.body || {};

      const prompt =
        body.prompt ||
        body.goal ||
        body.text ||
        (body.action && body.action.prompt) ||
        "";

      const copy = body.copy || {};

      risk = computeRiskVector({
        prompt: String(prompt || ""),
        copy: copy || {},
        proof: {},
        perf: null,
        ux: null,
        a11yPass: null,
      }) as RiskVector;

      // Use the path as the "route key" for decisions
      const routeKey = req.path || area || "/ai";
      decision = supDecide(routeKey, risk) as SupDecision;
    } catch (_err) {
      // Fail closed but not fatal: go strict, mark internal error
      decision = {
        mode: "strict",
        reasons: ["sup_internal_error"],
      };
    }

    // Attach to locals so other middleware (degrade, logging, etc.) can see it
    (res.locals as any).sup = { risk, decision };

    // Expose mode + reasons + policy version to clients
    try {
      res.setHeader("X-SUP-Mode", decision.mode);
      res.setHeader("X-SUP-Reasons", (decision.reasons || []).join(","));
      res.setHeader("X-SUP-Policy-Version", POLICY_VERSION);
    } catch {
      // ignore header failures
    }

    // If SUP says "block", short-circuit on hot routes
    if (decision.mode === "block") {
      const hot =
        req.method === "POST" &&
        (req.path === "/instant" ||
          req.path === "/one" ||
          req.path === "/act" ||
          req.path.startsWith("/act/"));

      if (hot) {
        const fallback = pickFailureFallback({
          kind: "sup_block",
          route: req.path,
          // we only have `reasons` here; use the first as the primary reason
          reason: (decision as any).reason || decision.reasons?.[0] || undefined,
        });

        return res.status(200).json({
          ok: true,
          result: {
            error: "sup_block",
            sup: {
              mode: decision.mode,
              reasons: decision.reasons || [],
            },
            fallback,
          },
        });
      }
    }

    // Otherwise, continue as normal
    return next();
  };
}