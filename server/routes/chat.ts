import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";
import { logger } from "../index.js";

const router = Router();

// Validation schemas
const sendMessageSchema = z.object({
  projectId: z.string().optional(),
  content: z.string().min(1).max(5000),
  type: z.enum(["ai-assistant", "collaboration", "support"]),
  ticketId: z.string().optional(),
});

/**
 * POST /api/chat/messages
 * Send a chat message (REST fallback for WebSocket)
 */
router.post("/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const validatedData = sendMessageSchema.parse(req.body);

    // Create user message
    const message = await storage.createChatMessage({
      userId: req.user.id,
      projectId: validatedData.projectId || null,
      role: "user",
      content: validatedData.content,
      metadata: {
        type: validatedData.type,
        ticketId: validatedData.ticketId,
      },
    });

    // For AI assistant, generate a response
    if (validatedData.type === "ai-assistant") {
      // TODO: Integrate with OpenAI
      const aiResponse = await storage.createChatMessage({
        userId: req.user.id,
        projectId: validatedData.projectId || null,
        role: "assistant",
        content: `I understand you want to: "${validatedData.content}". How can I help you build that?`,
        metadata: { type: "ai-assistant" },
      });

      return res.status(201).json({
        userMessage: message,
        aiResponse,
      });
    }

    res.status(201).json({ message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    logger.error("Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * GET /api/chat/history
 * Get chat history for current user
 */
router.get("/history", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const projectId = req.query.projectId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    const messages = await storage.getChatHistory(req.user.id, projectId, limit);

    res.status(200).json({ messages });
  } catch (error) {
    logger.error("Get chat history error:", error);
    res.status(500).json({ error: "Failed to get chat history" });
  }
});

/**
 * DELETE /api/chat/messages/:messageId
 * Delete a chat message
 */
router.delete("/messages/:messageId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await storage.deleteChatMessage(req.params.messageId);

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    logger.error("Delete message error:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
