import { setTimeout as delay } from "timers/promises";
import type { ExecRequest, ExecResult } from "../execute/types.ts";

const ENABLED = process.env.ENABLE_SANDBOX === "true";
const MAX = Math.max(1, parseInt(process.env.RUNNER_MAX_CONCURRENCY || "1", 10));
const HARD_TIMEOUT = 10_000; // hard cap (ms)

let active = 0;

export async function runLocalSandbox(req: ExecRequest): Promise<ExecResult> {
  const started = Date.now();
  if (!ENABLED) {
    return { ok: false, reason: "disabled", durationMs: Date.now() - started };
  }

  // simple in-memory concurrency gate
  while (active >= MAX) await delay(25);
  active++;

  try {
    // NOTE: real execution intentionally NOT implemented yet.
    // This is a safe stub so we can wire quotas/validation end-to-end.
    const wait = Math.min(req.timeoutMs ?? 800, HARD_TIMEOUT);
    await delay(wait);
    return {
      ok: true,
      stdout: "sandbox enabled (stub): no code executed",
      stderr: "",
      exitCode: 0,
      durationMs: Date.now() - started,
    };
  } finally {
    active--;
  }
}
