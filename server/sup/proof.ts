// server/sup/proof.ts
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { GateMap, RiskVector } from "./policy";

const FILE = path.join(".cache", "sup.proofs.jsonl");
function ensureDir() { try { fs.mkdirSync(".cache", { recursive: true }); } catch {} }
function nowIso() { return new Date().toISOString(); }

const SECRET = process.env.SUP_HMAC_SECRET || "dev-secret-change-me";

export type Proof = {
  at: string;
  requestId: string;
  policyVersion: string;
  gates: GateMap;
  risk: RiskVector;
  provider?: string;
  contentHash?: string;
  meta?: Record<string, any>;
  sig: string; // HMAC over the rest
};

function sign(payload: Omit<Proof, "sig">) {
  const h = crypto.createHmac("sha256", SECRET);
  h.update(JSON.stringify(payload));
  return h.digest("hex");
}

export function makeProof(input: Omit<Proof, "sig" | "at">): Proof {
  const base = { ...input, at: nowIso() };
  const sig = sign(base);
  return { ...base, sig };
}

export function writeProof(p: Proof) {
  try {
    ensureDir();
    fs.appendFileSync(FILE, JSON.stringify(p) + "\n");
  } catch {}
}
