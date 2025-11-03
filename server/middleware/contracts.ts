// server/middleware/contracts.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAndPrepare, lastGoodFor } from "../intent/dsl.ts";
import { pickFailureFallback } from "../qa/failure.playbook.ts";

type Patch = { sections?: string[]; copy?: Record<string, any>; brand?: Record<string, any> };

function buildMerged(base: any, patch: Patch) {
  return {
    ...base,
    sections: Array.isArray(patch.sections) ? patch.sections : (base?.sections || []),
    copy: { ...(base?.copy || {}), ...(patch.copy || {}) },
    brand: { ...(base?.brand || {}), ...(patch.brand || {}) },
  };
}

function contractsFailed(prepared: any): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Look for common shapes; stay defensive.
  const budgetsOk = prepared?.budgets?.ok;
  const issues = prepared?.issues || prepared?.errors || prepared?.__errors || [];
  const failed = prepared?.__contracts?.failures || [];

  if (budgetsOk === false) reasons.push("budgets_not_ok");
  if (Array.isArray(issues) && issues.length) reasons.push(...issues.map((x: any) => String(x)));
  if (Array.isArray(failed) && failed.length) reasons.push(...failed.map((x: any) => String(x)));

  return { ok: reasons.length === 0, reasons };
}

/**
 * Hard-stop guard for mutation routes that accept a patch relative to lastGood.
 * Expects: req.body.sessionId + (req.body.winner | req.body.patch | req.body.apply)
 */
export function contractsHardStop() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const path = String(req.path || "");
      const method = String(req.method || "GET").toUpperCase();
      if (method !== "POST") return next();

      // Only guard known mutators (cheap path check)
      const guardable = ["/act", "/chips/apply", "/ab/promote"];
      if (!guardable.some((p) => path.endsWith(p))) return next();

      const sessionId = String((req.body as any)?.sessionId || "").trim();
      if (!sessionId) return res.status(400).json({ ok: false, error: "missing sessionId" });

      const patch: Patch =
        (req.body as any).winner ||
        (req.body as any).patch ||
        (req.body as any).apply ||
        {};

      const base = (await lastGoodFor(sessionId)) || {};
      const merged = buildMerged(base, patch);

      // Dry-run: verify & harden
      const prepared = await verifyAndPrepare(merged);
      const verdict = contractsFailed(prepared);

      if (!verdict.ok) {
        const fallback = pickFailureFallback({
          kind: "contracts_failed",
          route: req.path,
        });

        return res.status(422).json({
          ok: false,
          error: "contracts_failed",
          reasons: verdict.reasons.slice(0, 8),
          fallback,
        });
      }

      // Pass along if caller wants to reuse the hardened spec
      (req as any).__prepared = prepared;
      next();
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  };
}
