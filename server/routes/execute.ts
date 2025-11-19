// server/routes/execute.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import ivm from 'isolated-vm';
import { authOptional } from '../middleware/auth.js';
import { logger } from '../middleware/logging.js';

const router = Router();

// ---- Execution limits from environment ----
const EXECUTION_TIMEOUT_MS = parseInt(process.env.EXECUTION_TIMEOUT_MS || '3000', 10);
const IVM_MEMORY_MB = parseInt(process.env.IVM_MEMORY_MB || '64', 10);
const EXECUTION_MAX_BYTES = parseInt(process.env.EXECUTION_MAX_BYTES || '65536', 10);

// Global kill switch: if DISABLE_EXECUTION="true", all runs are refused
const DISABLE_EXECUTION = process.env.DISABLE_EXECUTION === 'true';

// Max concurrent executions allowed on this app instance
// Tune per host: e.g. 5, 10, 20 depending on CPU/RAM
const EXEC_MAX_CONCURRENT = parseInt(process.env.EXEC_MAX_CONCURRENT || '10', 10);

// In-memory concurrency counter (per process)
let inFlight = 0;

// Validation schema
const executeCodeSchema = z.object({
  code: z.string().min(1).max(50000), // Max 50KB of code
});

/**
 * Execute JavaScript code in isolated-vm sandbox
 */
async function executeJavaScript(code: string): Promise<{
  stdout: string;
  stderr: string;
  result: any;
  executionTimeMs: number;
  status: 'completed' | 'timeout' | 'error';
  error?: string;
}> {
  const startTime = Date.now();
  let stdout = '';
  let stderr = '';
  let result: any = null;
  let status: 'completed' | 'timeout' | 'error' = 'completed';
  let error: string | undefined;

  try {
    // Create isolated VM with memory limit
    const isolate = new ivm.Isolate({ memoryLimit: IVM_MEMORY_MB });
    const context = await isolate.createContext();

    // Create console.log capture
    const jail = context.global;
    await jail.set('global', jail.derefInto());

    // Inject safe console.log
    await jail.set(
      '_logCapture',
      new ivm.Reference((msg: string) => {
        const output = String(msg) + '\n';
        if (stdout.length + output.length <= EXECUTION_MAX_BYTES) {
          stdout += output;
        } else {
          stdout += output.substring(0, EXECUTION_MAX_BYTES - stdout.length);
          stdout += '\n[OUTPUT TRUNCATED - MAX SIZE EXCEEDED]\n';
        }
      })
    );

    await jail.set(
      '_errorCapture',
      new ivm.Reference((msg: string) => {
        const output = String(msg) + '\n';
        if (stderr.length + output.length <= EXECUTION_MAX_BYTES) {
          stderr += output;
        } else {
          stderr += output.substring(0, EXECUTION_MAX_BYTES - stderr.length);
          stderr += '\n[ERROR OUTPUT TRUNCATED - MAX SIZE EXCEEDED]\n';
        }
      })
    );

    // Setup console in sandbox
    await context.eval(`
      global.console = {
        log: (...args) => {
          const msg = args.map(arg => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg, null, 2);
              } catch (e) {
                return String(arg);
              }
            }
            return String(arg);
          }).join(' ');
          _logCapture.applySync(undefined, [msg]);
        },
        error: (...args) => {
          const msg = args.map(arg => String(arg)).join(' ');
          _errorCapture.applySync(undefined, [msg]);
        },
        warn: (...args) => {
          const msg = 'WARNING: ' + args.map(arg => String(arg)).join(' ');
          _logCapture.applySync(undefined, [msg]);
        }
      };
    `);

    // Wrap user code to capture result
    const wrappedCode = `
      (function() {
        ${code}
      })();
    `;

    // Execute with timeout
    const script = await isolate.compileScript(wrappedCode);
    const runResult = await script.run(context, { timeout: EXECUTION_TIMEOUT_MS });

    // Convert result to transferable value (if it's an ivm object)
    if (runResult && typeof (runResult as any).copy === 'function') {
      result = await (runResult as any).copy();
    } else {
      result = runResult;
    }

    isolate.dispose();
  } catch (err: any) {
    if (err?.message && err.message.includes('Script execution timed out')) {
      status = 'timeout';
      error = `Execution timed out after ${EXECUTION_TIMEOUT_MS}ms`;
      stderr += `\nExecution timed out after ${EXECUTION_TIMEOUT_MS}ms\n`;
    } else {
      status = 'error';
      error = err?.message || 'Execution error';
      stderr += `\nError: ${error}\n`;
    }
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

/**
 * POST /api/execute
 * Execute JavaScript code in sandboxed environment
 */
router.post('/', authOptional, async (req: Request, res: Response) => {
  // 1) Global kill switch (emergency / abuse / cost)
  if (process.env.DISABLE_EXECUTION === 'true') {
    return res.status(503).json({
      error: 'Execution disabled',
      reason: 'DISABLE_EXECUTION flag is set. Please try again later.',
    });
  }

  // 2) Simple per-instance concurrency guard
  if (inFlight >= EXEC_MAX_CONCURRENT) {
    return res.status(429).json({
      error: 'Too many executions in progress',
      inFlight,
      maxConcurrent: EXEC_MAX_CONCURRENT,
    });
  }

  let counted = false;

  try {
    const validatedData = executeCodeSchema.parse(req.body);

    logger.info(
      { userId: (req as any).user?.id || 'anonymous' },
      'Executing JavaScript code'
    );

    inFlight++;
    counted = true;

    const result = await executeJavaScript(validatedData.code);

    logger.info(
      {
        userId: (req as any).user?.id || 'anonymous',
        executionTimeMs: result.executionTimeMs,
        status: result.status,
      },
      'Code execution completed'
    );

    // Keep response shape same as before
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Code execution error');
    return res.status(500).json({ error: 'Code execution failed' });
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
router.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    ok: true,
    disabled: DISABLE_EXECUTION,
    inFlight,
    maxConcurrent: EXEC_MAX_CONCURRENT,
    timeoutMs: EXECUTION_TIMEOUT_MS,
    memoryMb: IVM_MEMORY_MB,
    maxBytes: EXECUTION_MAX_BYTES,
  });
});

export default router;
