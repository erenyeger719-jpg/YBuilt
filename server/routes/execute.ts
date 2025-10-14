import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";
import { executeCode, getSupportedLanguages, isLanguageSupported } from "../services/codeExecution.js";
import { logger } from "../index.js";

const router = Router();

// Validation schema
const executeCodeSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1).max(50000), // Max 50KB of code
  projectId: z.string().optional(),
});

/**
 * POST /api/execute
 * Execute code in a sandboxed environment
 */
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const validatedData = executeCodeSchema.parse(req.body);

    // Check if language is supported
    if (!isLanguageSupported(validatedData.language)) {
      return res.status(400).json({
        error: `Unsupported language: ${validatedData.language}`,
        supportedLanguages: getSupportedLanguages(),
      });
    }

    // Create execution record
    const execution = await storage.createCodeExecution({
      userId: req.user.id,
      projectId: validatedData.projectId || null,
      language: validatedData.language,
      code: validatedData.code,
    });

    logger.info(`[CODE_EXEC] Starting execution ${execution.id} for user ${req.user.id}`);

    // Execute code
    const result = await executeCode(validatedData.code, validatedData.language);

    // Update execution record with results
    await storage.updateCodeExecution(execution.id, {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTimeMs: result.executionTimeMs,
      status: result.status === "completed" && result.exitCode === 0 ? "completed" : "failed",
    });

    logger.info(
      `[CODE_EXEC] Execution ${execution.id} completed in ${result.executionTimeMs}ms with status: ${result.status}`
    );

    res.status(200).json({
      executionId: execution.id,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    logger.error("Code execution error:", error);
    res.status(500).json({ error: "Code execution failed" });
  }
});

/**
 * GET /api/execute/history
 * Get code execution history
 */
router.get("/history", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const projectId = req.query.projectId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const executions = await storage.getCodeExecutionHistory(req.user.id, projectId, limit);

    res.status(200).json({ executions });
  } catch (error) {
    logger.error("Get execution history error:", error);
    res.status(500).json({ error: "Failed to get execution history" });
  }
});

/**
 * GET /api/execute/languages
 * Get list of supported languages
 */
router.get("/languages", (req, res) => {
  res.status(200).json({
    languages: getSupportedLanguages(),
  });
});

/**
 * GET /api/execute/:executionId
 * Get execution details
 */
router.get("/:executionId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const executions = await storage.getCodeExecutionHistory(req.user.id);
    const execution = executions.find((e) => e.id === req.params.executionId);

    if (!execution) {
      return res.status(404).json({ error: "Execution not found" });
    }

    res.status(200).json({ execution });
  } catch (error) {
    logger.error("Get execution error:", error);
    res.status(500).json({ error: "Failed to get execution" });
  }
});

export default router;
