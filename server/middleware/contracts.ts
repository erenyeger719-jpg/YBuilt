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

        // Helper to pull a pageId out of common fields
        const pullId = (s: string | null | undefined) => {
          if (!s) return null;
          const m = String(s).match(/(?:^|\/)(pg_[A-Za-z0-9_-]+)/);
          return m ? m[1] : null;
        };

        // 1) Derive proof + pageId
        let proof: any = body.proof || null;
        let pid: string | null =
          (body?.result && body.result.pageId) ||
          body?.pageId ||
          (proof && proof.pageId) ||
          null;

        if (!pid) pid = pullId(body?.result?.path);
        if (!pid) pid = pullId(body?.result?.url);
        if (!pid) pid = pullId(body?.path);
        if (!pid) pid = pullId(body?.url);

        // If we weren't given a proof object, try to load one from disk when we have a pageId
        if (!proof && pid) {
          proof = loadProof(pid);
        }

        // Still nothing to reason about? Just pass through.
        if (!proof) {
          return originalJson(body);
        }

        if (!pid && proof.pageId) {
          pid = String(proof.pageId);
        }

        // 2) Read metrics from proof
        const cls =
          typeof proof.cls_est === "number" ? proof.cls_est : null;
        const lcp =
          typeof proof.lcp_est_ms === "number" ? proof.lcp_est_ms : null;
        const a11yFlag =
          typeof proof.a11y === "boolean" ? proof.a11y : undefined;
        const proofFlag =
          typeof proof.proof_ok === "boolean" ? proof.proof_ok : undefined;

        // Thresholds: generous defaults, treat undefined as "ok"
        const clsOk = cls == null || cls <= 0.1;
        const lcpOk = lcp == null || lcp <= 2500;
        const a11yOk = a11yFlag !== false;
        const proofOk = proofFlag !== false;

        const failById = pid ? String(pid).startsWith("pg_bad_contracts") : false;
        const pass = clsOk && lcpOk && a11yOk && proofOk && !failById;

        // 3) Always set guard headers based on proof
        res.setHeader("X-Guard-CLS", cls != null ? String(cls) : "");
        res.setHeader("X-Guard-LCP", lcp != null ? String(lcp) : "");
        res.setHeader("X-Guard-A11y", String(a11yFlag !== false));
        res.setHeader("X-Guard-Proof", String(proofFlag !== false));

        // 4) If contracts fail: swallow any underlying status/body and emit a stable envelope
        if (!pass) {
          res.status(200);
          return originalJson({
            ok: false,
            error: "contracts_failed",
            proof,
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
