// server/routes/challenge.ts
import { Router } from "express";
import * as crypto from "node:crypto";

type Entry = { nonce: string; difficulty: number; exp: number };
const store = new Map<string, Entry>();

function sha(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function now() {
  return Date.now();
}
function prune() {
  const t = now();
  for (const [k, v] of store) if (t > v.exp) store.delete(k);
}
function makeToken() {
  return crypto.randomUUID();
}

/**
 * Proof-of-work: find `answer` such that sha(nonce + answer) starts with N hex zeros.
 * difficulty = number of leading hex '0' nibbles (e.g. 4 → "0000...")
 */
function ok(hash: string, difficulty: number) {
  const need = "0".repeat(Math.max(1, Math.min(8, difficulty)));
  return hash.startsWith(need);
}

const router = Router();

// POST /api/challenge/issue { difficulty?: number }
// -> { token, nonce, difficulty, ttl_sec }
router.post("/issue", (req, res) => {
  prune();
  const difficulty = Math.max(3, Math.min(6, parseInt(String((req.body || {}).difficulty ?? "4"), 10) || 4));
  const nonce = crypto.randomBytes(8).toString("hex");
  const token = makeToken();
  const ttlSec = 120;
  store.set(token, { nonce, difficulty, exp: now() + ttlSec * 1000 });
  return res.json({ ok: true, token, nonce, difficulty, ttl_sec: ttlSec });
});

// POST /api/challenge/verify { token, answer }
// -> { ok: true } or 400
router.post("/verify", (req, res) => {
  prune();
  const token = String((req.body || {}).token || "");
  const answer = String((req.body || {}).answer || "");
  if (!token || !answer) return res.status(400).json({ ok: false, error: "bad_request" });

  const entry = store.get(token);
  if (!entry) return res.status(400).json({ ok: false, error: "expired_or_unknown" });

  const h = sha(entry.nonce + answer);
  if (!ok(h, entry.difficulty)) return res.status(400).json({ ok: false, error: "invalid_solution" });

  // one-shot
  store.delete(token);
  return res.json({ ok: true });
});

export default router;
