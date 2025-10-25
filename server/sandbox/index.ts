import type { ExecRequest, ExecResult } from "../execute/types.ts";
import { runLocalSandbox } from "./local.ts";

export async function runSandbox(req: ExecRequest): Promise<ExecResult> {
  const impl = (process.env.RUNNER_IMPL || "local").toLowerCase();

  if (impl === "docker") {
    try {
      const { runDockerSandbox } = await import("./docker.ts");
      return runDockerSandbox(req);
    } catch {
      return {
        ok: false,
        reason: "docker_unavailable",
        durationMs: 0,
      };
    }
  }

  // default stub runner (safe, no exec)
  return runLocalSandbox(req);
}
