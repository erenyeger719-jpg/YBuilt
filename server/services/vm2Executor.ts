import { VM } from "vm2";
import { logger } from "../index.js";

/**
 * VM2-based JavaScript executor for safer code execution
 * 
 * Security features:
 * - Sandboxed execution with vm2
 * - Timeout enforcement
 * - Output size limits
 * - No require() access
 * - No filesystem access
 * - No process.env access
 */

const EXECUTION_TIMEOUT_MS = parseInt(process.env.EXECUTION_TIMEOUT_MS || "3000");
const MAX_CODE_OUTPUT = parseInt(process.env.MAX_CODE_OUTPUT || "65536");

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  status: "completed" | "timeout" | "error";
  error?: string;
}

/**
 * Execute JavaScript code using vm2 sandbox
 */
export async function executeJavaScriptWithVM2(
  code: string,
  timeout?: number
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const executionTimeout = timeout || EXECUTION_TIMEOUT_MS;

  let stdout = "";
  let stderr = "";
  let exitCode: number | null = 0;
  let status: "completed" | "timeout" | "error" = "completed";
  let error: string | undefined;

  try {
    // Create a sandbox with limited capabilities
    const sandbox = {
      console: {
        log: (...args: any[]) => {
          const output = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ') + '\n';
          
          if (stdout.length + output.length <= MAX_CODE_OUTPUT) {
            stdout += output;
          } else {
            stdout += output.substring(0, MAX_CODE_OUTPUT - stdout.length);
            stdout += "\n[OUTPUT TRUNCATED - MAX SIZE EXCEEDED]\n";
          }
        },
        error: (...args: any[]) => {
          const output = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ') + '\n';
          
          if (stderr.length + output.length <= MAX_CODE_OUTPUT) {
            stderr += output;
          } else {
            stderr += output.substring(0, MAX_CODE_OUTPUT - stderr.length);
            stderr += "\n[ERROR OUTPUT TRUNCATED - MAX SIZE EXCEEDED]\n";
          }
        },
        warn: (...args: any[]) => {
          const output = "WARNING: " + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ') + '\n';
          
          if (stderr.length + output.length <= MAX_CODE_OUTPUT) {
            stderr += output;
          } else {
            stderr += output.substring(0, MAX_CODE_OUTPUT - stderr.length);
            stderr += "\n[ERROR OUTPUT TRUNCATED - MAX SIZE EXCEEDED]\n";
          }
        },
      },
      // Provide some safe built-in objects
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
    };

    // Create VM instance with strict security settings
    const vm = new VM({
      timeout: executionTimeout,
      sandbox,
      eval: false,        // Disable eval
      wasm: false,        // Disable WebAssembly
      fixAsync: true,     // Fix async behavior
    });

    // Execute the code
    logger.info(`[VM2_EXEC] Executing JavaScript code with ${executionTimeout}ms timeout`);
    vm.run(code);

    const executionTime = Date.now() - startTime;
    logger.info(`[VM2_EXEC] Execution completed in ${executionTime}ms`);

    return {
      stdout: stdout || "",
      stderr: stderr || "",
      exitCode: 0,
      executionTimeMs: executionTime,
      status: "completed",
    };

  } catch (err: any) {
    const executionTime = Date.now() - startTime;

    // Check if it's a timeout error
    if (err.message && err.message.includes("Script execution timed out")) {
      logger.warn(`[VM2_EXEC] Execution timed out after ${executionTimeout}ms`);
      return {
        stdout,
        stderr: stderr + `\n[EXECUTION TIMEOUT - ${executionTimeout}ms exceeded]`,
        exitCode: null,
        executionTimeMs: executionTime,
        status: "timeout",
        error: "Script execution timed out",
      };
    }

    // Handle other errors
    logger.error(`[VM2_EXEC] Execution error:`, err);
    const errorMessage = err.message || "Unknown execution error";

    return {
      stdout,
      stderr: stderr + (stderr ? "\n" : "") + errorMessage,
      exitCode: 1,
      executionTimeMs: executionTime,
      status: "error",
      error: errorMessage,
    };
  }
}
