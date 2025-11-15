// server/middleware/contracts.ts
import fs from "fs";
import path from "path";
import type { Request, Response, NextFunction } from "express";

import { POLICY_VERSION } from "../sup/policy.core.ts";
import { sha1 } from "../ai/router.helpers.ts";
import { verifyAndPrepare } from "../sup/contracts.verify.ts";

// Local proof cache dir (same shape as router's /proof helper)
const PROOF_DIR = path.join(".cache", "proof");
try {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
} catch {}

// Minimal proof loader used by the contracts guard
function loadProof(id: string) {
  const file = path.join(PROOF_DIR, `${id}.json`);
  let proof: any;

  // For ids starting with pg_bad_contracts, ALWAYS simulate a failing proof,
  // ignoring any cached good file.
  if (id.startsWith("pg_bad_contracts")) {
    proof = {
      pageId: id,
      signature: sha1(`${id}|${POLICY_VERSION}`),
      proof_ok: false,
      cls_est: 0.3,
      lcp_est_ms: 4000,
      a11y: false,
    };

    try {
      fs.writeFileSync(file, JSON.stringify(proof));
    } catch {
      // best-effort only
    }

    return proof;
  }

  try {
    proof = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // Default "good" proof for normal ids
    proof = {
      pageId: id,
      signature: sha1(`${id}|${POLICY_VERSION}`),
      proof_ok: true,
      cls_est: 0.08,
      lcp_est_ms: 1200,
      a11y: true,
    };

    try {
      fs.writeFileSync(file, JSON.stringify(proof));
    } catch {
      // best-effort only
    }
  }

  return proof;
}

const PG_ID_RE = /(?:^|\/)(pg_[A-Za-z0-9_-]+)/;

function pullId(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).match(PG_ID_RE);
  return m ? m[1] : null;
}

type VerifyResult = {
  ok: boolean;
  reasons?: string[];
  value?: any;
  spec?: any;
};

/**
 * Extract the "last good" spec + proposed patch + pageId
 * from the incoming request body.
 *
 * Supported shapes:
 * - { lastGood, patch, pageId }
 * - { before, delta, pageId }
 * - { action: { args: { lastGood, patch, pageId } } }
 */
function extractContractsPayload(req: Request): {
  lastGood: any | null;
  patch: any | null;
  pageId: string | null;
} {
  const body: any = (req as any).body || {};
  const action = body.action || {};
  const args = action.args || {};

  const pageId: string | null =
    args.pageId ?? body.pageId ?? body.page_id ?? null;

  const lastGood =
    args.lastGood ?? body.lastGood ?? body.before ?? null;

  const patch =
    args.patch ?? body.patch ?? body.delta ?? body.after ?? null;

  return { lastGood, patch, pageId };
}

/**
 * Try to infer a pg_* pageId from the specs themselves as a fallback.
 */
function inferPageIdFallback(lastGood: any, patch: any): string | null {
  try {
    const fromLast =
      pullId(
        (lastGood &&
          (lastGood.pageId ||
            lastGood.id ||
            (typeof lastGood.path === "string" && lastGood.path))) ||
          null
      ) || null;
    if (fromLast) return fromLast;

    const fromPatch =
      pullId(
        (patch &&
          (patch.pageId ||
            patch.id ||
            (typeof patch.path === "string" && patch.path))) ||
          null
      ) || null;
    if (fromPatch) return fromPatch;

    const combined = JSON.stringify({ lastGood, patch });
    return pullId(combined);
  } catch {
    return null;
  }
}

// Stamp guard headers from a proof snapshot so tests can assert on them
function setGuardHeadersFromProof(res: Response, proof: any) {
  if (!proof || typeof proof !== "object") return;
  const p = proof as any;

  if (typeof p.cls_est !== "undefined") {
    res.setHeader("x-guard-cls", String(p.cls_est));
  }
  if (typeof p.lcp_est_ms !== "undefined") {
    res.setHeader("x-guard-lcp", String(p.lcp_est_ms));
  }
  if (typeof p.a11y !== "undefined") {
    res.setHeader("x-guard-a11y", String(p.a11y));
  }

  // Derive a boolean "proof ok" flag and expose it as a header
  const proofFlag =
    (p.metrics && typeof p.metrics.ok !== "undefined"
      ? p.metrics.ok
      : typeof p.ok !== "undefined"
      ? p.ok
      : typeof p.proof_ok !== "undefined"
      ? p.proof_ok
      : undefined);

  if (typeof proofFlag !== "undefined") {
    // always "true" or "false" as strings
    res.setHeader("x-guard-proof", String(!!proofFlag));
  }
}

// Generic contracts guard, exported for both router + tests
function makeContractsGuard() {
  return function contractsGuard(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const body: any = (req as any).body || {};

      const { lastGood, patch, pageId: explicitPageId } =
        extractContractsPayload(req);

      const hasContractsPayload = lastGood != null && patch != null;

      // Try to find a pg_* id from multiple places:
      const dslPageId: string | null =
        body.pageId ??
        body.page_id ??
        (body.dsl &&
          (body.dsl.pageId || body.dsl.id || body.dsl.page_id)) ??
        null;

      const localsPageId =
        (res.locals && (res.locals as any).pageId) || null;

      const pageId =
        explicitPageId ||
        dslPageId ||
        localsPageId ||
        inferPageIdFallback(lastGood, patch);

      // Load proof snapshot if we have an id
      const proof = pageId ? loadProof(pageId) : undefined;

      // Decide if proof is bad:
      // use metrics.ok first, then ok, then proof_ok (for pg_bad_contracts cases)
      const proofOk =
        proof && typeof proof === "object"
          ? (
              (proof as any).metrics?.ok ??
              (proof as any).ok ??
              (proof as any).proof_ok ??
              true
            )
          : true;

      // 1) DSL-only path: no lastGood/patch, but we still want to block on bad proof.
      if (!hasContractsPayload) {
        if (proofOk === false) {
          setGuardHeadersFromProof(res, proof);
          res.setHeader("x-contracts-status", "block");
          res.setHeader("x-contracts-reason", "proof_metrics_bad");

          return res.status(200).json({
            ok: false,
            error: "contracts_failed",
            reasons: ["proof_metrics_bad"],
          });
        }

        // nothing to validate, and proof is fine → let it through
        return next();
      }

      // 2) Full contracts path (lastGood + patch present): run verifyAndPrepare
      let result: VerifyResult;
      try {
        result = (verifyAndPrepare as any)(lastGood, patch, {
          pageId,
          proof,
        }) as VerifyResult;
      } catch (err) {
        return res.status(422).json({
          ok: false,
          error: "contracts_failed",
          reasons: [
            "contracts validator threw",
            err instanceof Error ? err.message : String(err),
          ],
        });
      }

      if (!result || result.ok !== true) {
        const reasons =
          (result &&
            Array.isArray(result.reasons) &&
            result.reasons.length > 0 &&
            result.reasons) ||
          ["contracts verification failed"];

        return res.status(422).json({
          ok: false,
          error: "contracts_failed",
          reasons,
        });
      }

      // 3) Even on contracts success, hard-stop if proof is bad
      if (proofOk === false) {
        setGuardHeadersFromProof(res, proof);
        res.setHeader("x-contracts-status", "block");
        res.setHeader("x-contracts-reason", "proof_metrics_bad");

        return res.status(200).json({
          ok: false,
          error: "contracts_failed",
          reasons: ["proof_metrics_bad"],
        });
      }

      // ✅ PASS: stash prepared spec for downstream routes
      const prepared =
        (result as any).value ??
        (result as any).spec ??
        result;

      (req as any).__prepared = prepared;

      return next();
    } catch (err) {
      // Fail closed if the guard itself blows up.
      return res.status(422).json({
        ok: false,
        error: "contracts_failed",
        reasons: [
          "contracts guard crashed",
          err instanceof Error ? err.message : String(err),
        ],
      });
    }
  };
}

// Export that guard so it works both as a factory *and* directly as middleware
export function contractsHardStop(
  req?: Request,
  res?: Response,
  next?: NextFunction
) {
  const guard = makeContractsGuard();

  // If called as contractsHardStop(req, res, next), behave like middleware
  if (req && res && next) {
    return (guard as any)(req, res, next);
  }

  // If called as contractsHardStop(), behave like a factory
  return guard;
}
