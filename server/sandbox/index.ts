import type { ExecRequest, ExecResult } from "../execute/types.ts";
import { runLocalSandbox } from "./local.ts";

const MAX = Math.max(1, parseInt(process.env.RUNNER_MAX_CONCURRENCY || "1", 10));
let active = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquire() {
  while (active >= MAX) await sleep(25);
  active++;
}
function release() {
  active = Math.max(0, active - 1);
}

export async function runSandbox(req: ExecRequest): Promise<ExecResult> {
  // extra safety: respect flag here too
  if (process.env.ENABLE_SANDBOX !== "true") {
    return { ok: false, reason: "disabled", durationMs: 0 };
  }

  await acquire();
  try {
    const impl = (process.env.RUNNER_IMPL || "local").toLowerCase();
    if (impl === "docker") {
      try {
        const { runDockerSandbox } = await import("./docker.ts");
        return runDockerSandbox(req);
      } catch {
        return { ok: false, reason: "docker_unavailable", durationMs: 0 };
      }
    }
    // default stub/local runner
    return runLocalSandbox(req);
  } finally {
    release();
  }
}
