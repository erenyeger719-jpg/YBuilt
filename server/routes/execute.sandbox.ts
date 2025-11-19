// server/routes/execute.sandbox.ts
//
// V1 battle-ready execute endpoint using Node's built-in `vm`.
// Features:
// - Input validation (Zod)
// - Global kill switch (DISABLE_EXECUTION)
// - Optional enable flag (ENABLE_SANDBOX)
// - Simple per-instance concurrency cap (EXEC_MAX_CONCURRENT)
// - Output size limit (EXECUTION_MAX_BYTES)
// - Health endpoint for monitoring
//
// Note:
// - This is a *local* sandbox suitable for v1.
// - Remote runners / microVMs can plug in later behind RUNNER_IMPL.

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import * as vm from "node:vm";
import { authOptional } from "../middleware/auth.js";
import { logger } from "../middleware/logging.js";

const router = Router();

// ---- Execution limits from environment ----

// Optional global "feature switch" for the execute API as a whole.
// If ENABLE_SANDBOX !== "true", we treat the endpoint as disabled.
const ENABLE_SANDBOX = process.env.ENABLE_SANDBOX === "true";

const EXECUTION_TIMEOUT_MS = parseInt(
  process.env.EXECUTION_TIMEOUT_MS || "3000",
  10
);

// This is more of a "hint" here; Node's vm doesn't enforce memory directly,
// but we keep it for future remote runner alignment.
const IVM_MEMORY_MB = parseInt(process.env.IVM_MEMORY_MB || "64", 10);

const EXECUTION_MAX_BYTES = parseInt(
  process.env.EXECUTION_MAX_BYTES || "65536",
  10
);

// Global kill switch: if DISABLE_EXECUTION="true", all runs are refused
const DISABLE_EXECUTION = process.env.DISABLE_EXECUTION === "true";

// Max concurrent executions allowed on this app instance
// Tune per host: e.g. 5, 10, 20 depending on CPU/RAM
const EXEC_MAX_CONCURRENT = parseInt(
  process.env.EXEC_MAX_CONCURRENT || "10",
  10
);

// In-memory concurrency counter (per process)
let inFlight = 0;

// Validation schema
const executeCodeSchema = z.object({
  code: z.string().min(1).max(50_000), // Max 50KB of code
});

// --- tiny helpers ---

function clampOutput(
  current: string,
  extra: string,
  limit: number,
  truncatedLabel: string
): string {
  if (extra.length === 0) return current;

  if (current.length >= limit) {
    return current;
  }

  const remaining = limit - current.length;
  if (extra.length <= remaining) {
    return current + extra;
  }

  return (
    current +
    extra.slice(0, remaining) +
    `\n[${truncatedLabel} - MAX SIZE EXCEEDED]\n`
  );
}

function formatConsoleArgs(args: any[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

function safeSerializeResult(value: any, maxBytes: number): any {
  // Try to JSON-serialize; if it's too big or fails, fall back to a string.
  try {
    const json = JSON.stringify(value);
    if (json.length > maxBytes) {
      return "[RESULT TRUNCATED - TOO LARGE TO RETURN]";
    }
    // Parse back so the result is plain JSON, not arbitrary shapes
    return JSON.parse(json);
  } catch {
    return String(value);
  }
}

// ---- Core execution using Node's vm ----

type ExecStatus = "completed" | "timeout" | "error";

type ExecResult = {
  stdout: string;
  stderr: string;
  result: any;
  executionTimeMs: number;
  status: ExecStatus;
  error?: string;
};

function executeJavaScript(code: string): ExecResult {
  const startTime = Date.now();

  let stdout = "";
  let stderr = "";
  let result: any = null;
  let status: ExecStatus = "completed";
  let error: string | undefined;

  try {
    // Prepare sandboxed console
    const sandboxConsole = {
      log: (...args: any[]) => {
        const msg = formatConsoleArgs(args) + "\n";
        stdout = clampOutput(stdout, msg, EXECUTION_MAX_BYTES, "OUTPUT TRUNCATED");
      },
      error: (...args: any[]) => {
        const msg = formatConsoleArgs(args) + "\n";
        stderr = clampOutput(
          stderr,
          msg,
          EXECUTION_MAX_BYTES,
          "ERROR OUTPUT TRUNCATED"
        );
      },
      warn: (...args: any[]) => {
        const msg = "WARNING: " + formatConsoleArgs(args) + "\n";
        stdout = clampOutput(stdout, msg, EXECUTION_MAX_BYTES, "OUTPUT TRUNCATED");
      },
    };

    // Minimal sandbox object
    const sandbox: Record<string, any> = {
      console: sandboxConsole,
    };

    const context = vm.createContext(sandbox);

    // Wrap code in an IIFE so we get the final expression as a "return" value
    const wrappedCode = `
      (function() {
        "use strict";
        ${code}
      })();
    `;

    const script = new vm.Script(wrappedCode, {
      filename: "user-code.js",
      displayErrors: true,
    });

    let rawResult: any;

    try {
      rawResult = script.runInContext(context, {
        timeout: EXECUTION_TIMEOUT_MS,
      });
    } catch (err: any) {
      if (
        typeof err?.message === "string" &&
        err.message.includes("Script execution timed out")
      ) {
        status = "timeout";
        error = `Execution timed out after ${EXECUTION_TIMEOUT_MS}ms`;
        stderr = clampOutput(
          stderr,
          `Execution timed out after ${EXECUTION_TIMEOUT_MS}ms\n`,
          EXECUTION_MAX_BYTES,
          "ERROR OUTPUT TRUNCATED"
        );
      } else {
        status = "error";
        error = err?.message || "Execution error";
        stderr = clampOutput(
          stderr,
          `Error: ${error}\n`,
          EXECUTION_MAX_BYTES,
          "ERROR OUTPUT TRUNCATED"
        );
      }
      rawResult = undefined;
    }

    if (status === "completed") {
      result = safeSerializeResult(rawResult, EXECUTION_MAX_BYTES);
    } else {
      result = null;
    }
  } catch (outerErr: any) {
    status = "error";
    error = outerErr?.message || "Execution error (outer)";
    stderr = clampOutput(
      stderr,
      `Error: ${error}\n`,
      EXECUTION_MAX_BYTES,
      "ERROR OUTPUT TRUNCATED"
    );
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    stdout,
    stderr,
    result,
    executionTimeMs,
    status,
    error,
  };
}

// ---- Routes ----

/**
 * POST /api/execute
 * Execute JavaScript code in sandboxed environment
 */
router.post("/", authOptional, (req: Request, res: Response) => {
  // 0) Global feature flag for sandbox as a whole
  if (!ENABLE_SANDBOX) {
    return res.status(503).json({
      error: "Sandbox disabled",
      reason: "ENABLE_SANDBOX is not true in the environment.",
    });
  }

  // 1) Global kill switch (emergency / abuse / cost)
  if (DISABLE_EXECUTION) {
    return res.status(503).json({
      error: "Execution disabled",
      reason:
        "DISABLE_EXECUTION flag is set. Please try again later or contact support.",
    });
  }

  // 2) Simple per-instance concurrency guard
  if (inFlight >= EXEC_MAX_CONCURRENT) {
    return res.status(429).json({
      error: "Too many executions in progress",
      inFlight,
      maxConcurrent: EXEC_MAX_CONCURRENT,
    });
  }

  let counted = false;

  try {
    const validatedData = executeCodeSchema.parse(req.body);

    logger.info(
      {
        userId: (req as any).user?.id || "anonymous",
      },
      "Executing JavaScript code (Node vm sandbox)"
    );

    inFlight++;
    counted = true;

    const execResult = executeJavaScript(validatedData.code);

    logger.info(
      {
        userId: (req as any).user?.id || "anonymous",
        executionTimeMs: execResult.executionTimeMs,
        status: execResult.status,
      },
      "Code execution completed"
    );

    return res.status(200).json(execResult);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    logger.error({ error }, "Code execution error");
    return res.status(500).json({ error: "Code execution failed" });
  } finally {
    if (counted && inFlight > 0) {
      inFlight -= 1;
    }
  }
});

/**
 * GET /api/execute/health
 * Tiny health endpoint for monitoring / debugging
 */
router.get("/health", (_req: Request, res: Response) => {
  return res.status(200).json({
    ok: true,
    enabled: ENABLE_SANDBOX && !DISABLE_EXECUTION,
    sandboxEnabledFlag: ENABLE_SANDBOX,
    executionDisabledFlag: DISABLE_EXECUTION,
    inFlight,
    maxConcurrent: EXEC_MAX_CONCURRENT,
    timeoutMs: EXECUTION_TIMEOUT_MS,
    memoryMbHint: IVM_MEMORY_MB,
    maxBytes: EXECUTION_MAX_BYTES,
  });
});

export default router;
