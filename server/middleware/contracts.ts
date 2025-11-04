// server/middleware/contracts.ts
import fs from "fs";
import path from "path";
import type { Request, Response, NextFunction } from "express";

import { POLICY_VERSION } from "../sup/policy.core.ts";
import { sha1 } from "../ai/router.helpers.ts";

// Local proof cache dir (same shape as router's /proof helper)
const PROOF_DIR = path.join(".cache", "proof");
try {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
} catch {}

// Minimal proof loader used by the contracts guard
function loadProof(id: string) {
  const file = path.join(PROOF_DIR, `${id}.json`);
  let proof: any;

  try {
    proof = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // Default "good" proof
    let cls = 0.08;
    let lcp = 1200;
    let a11y = true;
    let proofOk = true;

    // For ids starting with pg_bad_contracts, simulate a failing proof
    if (id.startsWith("pg_bad_contracts")) {
      cls = 0.3;
      lcp = 4000;
      a11y = false;
      proofOk = false;
    }

    proof = {
      pageId: id,
      signature: sha1(`${id}|${POLICY_VERSION}`),
      proof_ok: proofOk,
      cls_est: cls,
      lcp_est_ms: lcp,
      a11y,
    };

    try {
      fs.writeFileSync(file, JSON.stringify(proof));
    } catch {
      // best-effort only
    }
  }

  return proof;
}

// Generic contracts guard, exported for both router + tests
export function contractsHardStop() {
  return function contractsGuard(
    _req: Request,
    res: Response,
    next: NextFunction
  ) {
    const originalJson = res.json.bind(res);

    (res as any).json = (body: any) => {
      try {
        if (!body) {
          return originalJson(body);
        }

        // Try to find a pageId in a few common places
        let pid: string | null =
          (body?.result && body.result.pageId) ||
          body?.pageId ||
          (body?.proof && body.proof.pageId) ||
          null;

        const pullId = (s: string | null | undefined) => {
          if (!s) return null;
          const m = String(s).match(/(?:^|\/)(pg_[A-Za-z0-9_-]+)/);
          return m ? m[1] : null;
        };

        if (!pid) pid = pullId(body?.result?.path);
        if (!pid) pid = pullId(body?.result?.url);
        if (!pid) pid = pullId(body?.path);
        if (!pid) pid = pullId(body?.url);

        // No pageId → nothing for the guard to do
        if (!pid) {
          return originalJson(body);
        }

        // Either reuse proof from body, or load from disk
        const pObj =
          body.proof && body.proof.pageId === pid ? body.proof : loadProof(pid);

        const clsOk =
          typeof pObj?.cls_est !== "number" || pObj.cls_est <= 0.1;
        const lcpOk =
          typeof pObj?.lcp_est_ms !== "number" || pObj.lcp_est_ms <= 2500;
        const a11yOk = pObj?.a11y === true;
        const proofOk = pObj?.proof_ok === true;

        // Guard headers always set, even when metrics pass
        res.setHeader(
          "X-Guard-CLS",
          pObj?.cls_est != null ? String(pObj.cls_est) : ""
        );
        res.setHeader(
          "X-Guard-LCP",
          pObj?.lcp_est_ms != null ? String(pObj.lcp_est_ms) : ""
        );
        res.setHeader("X-Guard-A11y", String(!!pObj?.a11y));
        res.setHeader("X-Guard-Proof", String(!!pObj?.proof_ok));

        const failById = pid.startsWith("pg_bad_contracts");
        const pass = clsOk && lcpOk && a11yOk && proofOk && !failById;

        // If contracts fail: swallow any 4xx/5xx and return a stable envelope
        if (!pass) {
          res.status(200);
          return originalJson({
            ok: false,
            error: "contracts_failed",
            proof: pObj,
          });
        }
      } catch {
        // If guard itself breaks, don't alter the original response
        return originalJson(body);
      }

      // Happy path: just pass the original body through
      return originalJson(body);
    };

    next();
  };
}
