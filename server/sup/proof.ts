// server/sup/proof.ts
import fs from "fs";
import path from "path";

export type ProofMeta = {
  endpoint: string;
  status: number;
  ms: number;
};

export type Proof = {
  requestId: string;
  policyVersion: string;
  gates: Record<string, boolean>; // keep it loose; policy owns the schema
  risk: Record<string, unknown>;  // ditto
  provider: string;
  contentHash: string;
  meta: ProofMeta;
  ts: string; // ISO timestamp
};

/**
 * Build a normalized proof object from inputs.
 * Keep this dead-simple and deterministic so downstream tooling can tail/parse easily.
 */
export function makeProof(input: {
  requestId: string;
  policyVersion: string;
  gates: Record<string, boolean>;
  risk: Record<string, unknown>;
  provider: string;
  contentHash: string;
  meta: ProofMeta;
}): Proof {
  return {
    requestId: input.requestId,
    policyVersion: input.policyVersion,
    gates: input.gates,
    risk: input.risk,
    provider: input.provider,
    contentHash: input.contentHash,
    meta: {
      endpoint: input.meta.endpoint,
      status: input.meta.status,
      ms: input.meta.ms,
    },
    ts: new Date().toISOString(),
  };
}

/**
 * Append the proof as JSONL into .cache/proofs.log.
 * Atomic enough for our dev/runtime; rotate later if the file grows.
 */
export function writeProof(p: Proof) {
  try {
    fs.mkdirSync(".cache", { recursive: true });
    const file = path.join(".cache", "proofs.log");
    fs.appendFileSync(file, JSON.stringify(p) + "\n", "utf8");
  } catch {
    // don’t throw from a logging side-effect; guardrails must not crash the request
  }
}
