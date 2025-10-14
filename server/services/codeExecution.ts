import { spawn } from "child_process";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { logger } from "../index.js";

/**
 * ⚠️ SECURITY WARNING ⚠️
 * 
 * This code execution service uses child_process and is NOT production-ready.
 * It lacks proper sandboxing and can be exploited for Remote Code Execution (RCE).
 * 
 * For production use, you MUST implement one of:
 * 1. Container-based execution (Docker, Podman)
 * 2. VM-based isolation (Firecracker, gVisor)
 * 3. Remote execution service (AWS Lambda, Google Cloud Functions)
 * 4. Dedicated sandbox runtime (E2B, Replit Code Execution API)
 * 
 * Current implementation provides MINIMAL protection through:
 * - Pattern-based code filtering (easily bypassed)
 * - Timeout limits
 * - Output size limits
 * - Restricted environment variables
 * 
 * DO NOT USE IN PRODUCTION WITHOUT PROPER SANDBOXING!
 */

const TIMEOUT = parseInt(process.env.CODE_EXECUTION_TIMEOUT || "5000");
const MAX_OUTPUT = parseInt(process.env.CODE_EXECUTION_MAX_OUTPUT || "10000");
const TEMP_DIR = path.join(process.cwd(), "tmp", "executions");

// Strict execution mode - disable execution entirely if not explicitly enabled
const EXECUTION_ENABLED = process.env.ENABLE_CODE_EXECUTION === "true";

if (!EXECUTION_ENABLED) {
  logger.warn("[CODE_EXEC] Code execution is DISABLED. Set ENABLE_CODE_EXECUTION=true to enable (NOT recommended for production without proper sandboxing)");
}

// Supported languages and their execution commands
const LANGUAGE_CONFIG: Record<string, {
  extension: string;
  command: string;
  args: (filePath: string) => string[];
  runtimeCheck?: string;
}> = {
  javascript: {
    extension: ".js",
    command: "node",
    args: (filePath) => [filePath],
    runtimeCheck: "node",
  },
  typescript: {
    extension: ".ts",
    command: "npx",
    args: (filePath) => ["tsx", filePath],
    runtimeCheck: "node",
  },
  python: {
    extension: ".py",
    command: "python3",
    args: (filePath) => [filePath],
    runtimeCheck: "python3",
  },
  bash: {
    extension: ".sh",
    command: "bash",
    args: (filePath) => [filePath],
  },
};

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  status: "completed" | "timeout" | "error";
  error?: string;
}

/**
 * Validate code for dangerous patterns
 */
function validateCode(code: string, language: string): { valid: boolean; error?: string } {
  // Basic security checks
  const dangerousPatterns = [
    /rm\s+-rf/gi,                    // Dangerous delete commands
    /:\(\)\{\s*:\|\:&\s*\}/gi,       // Fork bomb
    /eval\s*\(/gi,                    // Eval (for JS/Python)
    /exec\s*\(/gi,                    // Exec (potentially dangerous)
    /system\s*\(/gi,                  // System calls
    /subprocess\./gi,                 // Python subprocess
    /child_process/gi,                // Node child_process
    /fs\.unlink/gi,                   // File deletion
    /fs\.rmdir/gi,                    // Directory deletion
    /require\s*\(\s*['"]child_process['"]\s*\)/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: `Code contains potentially dangerous pattern: ${pattern.source}`,
      };
    }
  }

  // Language-specific checks
  if (language === "bash" || language === "sh") {
    if (code.includes("sudo") || code.includes("su ")) {
      return { valid: false, error: "Privilege escalation commands not allowed" };
    }
  }

  return { valid: true };
}

/**
 * Execute code in a sandboxed environment
 */
export async function executeCode(
  code: string,
  language: string
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Check if execution is enabled
  if (!EXECUTION_ENABLED) {
    return {
      stdout: "",
      stderr: "Code execution is disabled for security reasons. Enable with ENABLE_CODE_EXECUTION=true (requires proper sandboxing in production)",
      exitCode: 1,
      executionTimeMs: 0,
      status: "error",
      error: "Code execution disabled",
    };
  }

  // Validate language support
  const config = LANGUAGE_CONFIG[language.toLowerCase()];
  if (!config) {
    return {
      stdout: "",
      stderr: `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_CONFIG).join(", ")}`,
      exitCode: 1,
      executionTimeMs: 0,
      status: "error",
      error: "Unsupported language",
    };
  }

  // Validate code for security
  const validation = validateCode(code, language);
  if (!validation.valid) {
    return {
      stdout: "",
      stderr: validation.error || "Code validation failed",
      exitCode: 1,
      executionTimeMs: 0,
      status: "error",
      error: validation.error,
    };
  }

  // Create temp directory if it doesn't exist
  await mkdir(TEMP_DIR, { recursive: true });

  // Create temporary file
  const executionId = randomUUID();
  const fileName = `exec_${executionId}${config.extension}`;
  const filePath = path.join(TEMP_DIR, fileName);

  try {
    // Write code to file
    await writeFile(filePath, code, "utf-8");

    // Execute code
    const result = await executeInSandbox(config.command, config.args(filePath));

    const executionTime = Date.now() - startTime;

    return {
      ...result,
      executionTimeMs: executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error(`[CODE_EXEC] Error executing code:`, error);

    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown error",
      exitCode: 1,
      executionTimeMs: executionTime,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    // Clean up temp file
    try {
      await unlink(filePath);
    } catch (error) {
      logger.warn(`[CODE_EXEC] Failed to delete temp file: ${filePath}`);
    }
  }
}

/**
 * Execute command in sandbox with timeout and output limits
 */
function executeInSandbox(
  command: string,
  args: string[]
): Promise<Omit<ExecutionResult, "executionTimeMs">> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let didTimeout = false;

    const child = spawn(command, args, {
      timeout: TIMEOUT,
      env: {
        ...process.env,
        // Restrict environment
        HOME: "/tmp",
        PATH: process.env.PATH,
      },
    });

    // Capture stdout with size limit
    child.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length <= MAX_OUTPUT) {
        stdout += chunk;
      } else {
        stdout += chunk.substring(0, MAX_OUTPUT - stdout.length);
        stdout += "\n[OUTPUT TRUNCATED - MAX SIZE EXCEEDED]";
        child.kill();
      }
    });

    // Capture stderr with size limit
    child.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length <= MAX_OUTPUT) {
        stderr += chunk;
      } else {
        stderr += chunk.substring(0, MAX_OUTPUT - stderr.length);
        stderr += "\n[ERROR OUTPUT TRUNCATED - MAX SIZE EXCEEDED]";
        child.kill();
      }
    });

    // Handle timeout
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      child.kill("SIGKILL");
    }, TIMEOUT);

    // Handle process completion
    child.on("close", (code, signal) => {
      clearTimeout(timeoutId);

      if (didTimeout) {
        resolve({
          stdout,
          stderr: stderr + `\n[EXECUTION TIMEOUT - ${TIMEOUT}ms exceeded]`,
          exitCode: null,
          status: "timeout",
          error: "Execution timeout",
        });
      } else if (signal) {
        resolve({
          stdout,
          stderr: stderr + `\n[PROCESS KILLED - Signal: ${signal}]`,
          exitCode: null,
          status: "error",
          error: `Process killed with signal: ${signal}`,
        });
      } else {
        resolve({
          stdout,
          stderr,
          exitCode: code,
          status: "completed",
        });
      }
    });

    // Handle spawn errors
    child.on("error", (error) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr: error.message,
        exitCode: 1,
        status: "error",
        error: error.message,
      });
    });
  });
}

/**
 * Get list of supported languages
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_CONFIG);
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
  return language.toLowerCase() in LANGUAGE_CONFIG;
}
