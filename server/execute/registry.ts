// server/execute/registry.ts
//
// Central runner registry for the execution backend.
//
// Responsibilities:
// - Decide which runner to use based on RUNNER_IMPL.
// - Apply basic concurrency / backpressure so we don't overload the node.
// - Log simple telemetry for each run (runner type, duration).
//
// v1 runners:
// - "local" (default): delegates to runSandbox (local/docker implementation).
// - "remote": returns a "not configured" stub for now.
// - anything else: falls back to "local".
//
// NOTE: This module is intentionally small and side-effect free so it can be
// easily tested (see tests/execute.registry.spec.ts).

import { runSandbox } from "../sandbox/index.ts";
import type { ExecRequest } from "./types.ts";

// --- Concurrency / backpressure config ---

// Max number of jobs running at the same time.
// You can tune this via env if needed.
const MAX_CONCURRENT = Math.max(
  parseInt(process.env.EXEC_MAX_CONCURRENT || "4", 10) || 1,
  1
);

// Optional queue so short spikes don't immediately fail.
// 0 = no queue; any overflow returns an error stub.
const MAX_QUEUE = Math.max(
  parseInt(process.env.EXEC_MAX_QUEUE || "16", 10) || 0,
  0
);

type RunnerKind = "local" | "remote";

type ExecResult = any; // keep loose here; callers/tests only care about shape of stubs.

type QueuedJob = {
  req: ExecRequest;
  resolve: (value: ExecResult) => void;
  reject: (reason?: unknown) => void;
};

let active = 0;
const queue: QueuedJob[] = [];

// --- Small helpers ---

function getRunnerKind(): RunnerKind | "unknown" {
  const raw = (process.env.RUNNER_IMPL || "local").toLowerCase().trim();

  if (raw === "local") return "local";
  if (raw === "remote") return "remote";
  // We treat anything else as unknown → fallback to local.
  return "unknown";
}

function logInfo(msg: string, meta?: Record<string, unknown>) {
  // Best-effort logging; no external dependency.
  // Keep it quiet but structured enough to be greppable.
  if (meta) {
    // eslint-disable-next-line no-console
    console.log("[execute]", msg, meta);
  } else {
    // eslint-disable-next-line no-console
    console.log("[execute]", msg);
  }
}

function logError(msg: string, meta?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.error("[execute]", msg, meta || {});
}

// --- Core single-run executor (no queue/concurrency yet) ---

async function runSingle(req: ExecRequest): Promise<ExecResult> {
  const runnerKind = getRunnerKind();
  const startedAt = Date.now();

  if (runnerKind === "remote") {
    // v1: remote runner is not wired yet. We expose a clean stub instead of
    // failing at runtime, so the rest of the platform can ship now.
    const durationMs = Date.now() - startedAt;
    const stub = {
      ok: false,
      error: "remote_runner_not_configured" as const,
      runnerType: "remote" as const,
      durationMs,
    };

    logInfo("remote runner requested but not configured", stub);
    return stub;
  }

  // "local" or "unknown" → we always delegate to runSandbox.
  // If RUNNER_IMPL is weird, we still keep platform behaviour predictable.
  const effectiveRunner: RunnerKind = "local";

  try {
    const raw = await runSandbox(req);
    const durationMs = Date.now() - startedAt;

    // Always attach runnerType so tests and callers can introspect.
    const result =
      raw && typeof raw === "object"
        ? {
            ...(raw as Record<string, unknown>),
            runnerType: effectiveRunner,
          }
        : {
            ok: true,
            value: raw,
            runnerType: effectiveRunner,
          };

    logInfo("sandbox run complete", {
      runnerType: effectiveRunner,
      durationMs,
    });

    return result;
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;

    logError("sandbox run failed", {
      runnerType: effectiveRunner,
      durationMs,
      error: err?.message || String(err),
    });

    throw err;
  }
}

// --- Concurrency wrapper with optional queue ---

function maybeDequeueNext() {
  if (active >= MAX_CONCURRENT) return;
  const next = queue.shift();
  if (!next) return;

  active++;
  runSingle(next.req)
    .then(next.resolve, next.reject)
    .finally(() => {
      active--;
      maybeDequeueNext();
    });
}

/**
 * Main entrypoint used by the rest of the platform.
 *
 * - Respects MAX_CONCURRENT and MAX_QUEUE.
 * - For overflow:
 *   - If queue has room: enqueues the job.
 *   - If queue is full: returns a fast error stub.
 */
export function runInSandbox(req: ExecRequest): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    // If we have concurrency budget, run immediately.
    if (active < MAX_CONCURRENT) {
      active++;
      runSingle(req)
        .then(resolve, reject)
        .finally(() => {
          active--;
          maybeDequeueNext();
        });
      return;
    }

    // No concurrency slot left.
    if (queue.length >= MAX_QUEUE) {
      // Hard backpressure: fail fast with a clear stub.
      const stub = {
        ok: false,
        error: "too_many_jobs" as const,
        runnerType: "local" as const,
      };
      logInfo("execution rejected due to concurrency/queue limits", {
        active,
        queueLength: queue.length,
      });
      resolve(stub);
      return;
    }

    // Soft backpressure: enqueue.
    queue.push({ req, resolve, reject });
    logInfo("execution enqueued", {
      active,
      queueLength: queue.length,
    });
  });
}
