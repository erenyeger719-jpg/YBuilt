// server/mw/sup.ts
import type { Request, Response, NextFunction } from "express";
import * as policy from "../sup/policy";
import type { GateMap } from "../sup/policy";
import { keyFor, checkBudget, recordHit } from "../sup/ledger";
import { makeProof, writeProof } from "../sup/proof";

const { computeRiskVector, decideGates, contentHash } = policy as {
  computeRiskVector: typeof import("../sup/policy").computeRiskVector;
  decideGates: typeof import("../sup/policy").decideGates;
  contentHash: typeof import("../sup/policy").contentHash;
};

// Fallback if the policy module doesn’t export it
const POLICY_VERSION: string = (policy as any).POLICY_VERSION ?? "v1";

function idFrom(req: Request) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.socket?.remoteAddress || "");
  const session = String((req as any).session?.id || (req as any).sessionId || "");
  const apiKey = String(req.headers["x-api-key"] || "");
  return { ip, session, apiKey };
}

export function supGuard(endpointName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = idFrom(req);
    const key = keyFor(id);

    // Quotas
    const budget = checkBudget(key);
    if (!budget.ok) {
      return res.status(429).json({
        ok: false,
        error: "quota_exceeded",
        remaining: budget,
      });
    }
    recordHit(key);

    // Risk + gates
    const body: any = req.body || {};
    const prompt = String(body.prompt || body.user || "");
    const copy = String(body.copy || "");

    const risk = computeRiskVector({
      prompt,
      copy,
      ua: String(req.headers["user-agent"] || ""),
      velocityScore: 0, // hook your velocity anomaly score here
      disposableMail: false, // wire later from signup/email checks
    });
    const gates: GateMap = decideGates(risk, endpointName);

    // Attach for downstream handlers
    (req as any).sup = { risk, gates, policyVersion: POLICY_VERSION };

    // After response, write proof
    const started = Date.now();
    res.on("finish", () => {
      try {
        const p = makeProof({
          requestId: String((req as any).id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
          policyVersion: POLICY_VERSION,
          gates,
          risk,
          provider: String((res as any).locals?.provider || ""),
          contentHash: contentHash(copy || prompt),
          meta: {
            endpoint: endpointName,
            status: res.statusCode,
            ms: Date.now() - started,
          },
        });
        writeProof(p);
      } catch {}
    });

    next();
  };
}
