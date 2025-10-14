import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { get, all, run } from '../db/sqlite.js';
import { authRequired } from '../middleware/auth.js';
import { logger } from '../middleware/logging.js';

const router = Router();

// Validation schema
const sendMessageSchema = z.object({
  message: z.string().min(1).max(5000),
});

/**
 * GET /api/chat
 * Get last N chat messages for authenticated user
 */
router.get('/', authRequired, (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const limit = parseInt(req.query.limit as string) || 100;

    const messages = all<{
      id: number;
      user_id: number;
      message: string;
      created_at: string;
    }>(
      'SELECT id, user_id, message, created_at FROM chats WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [req.user.id, limit]
    );

    res.status(200).json({
      messages: messages.reverse().map(m => ({
        id: m.id,
        userId: m.user_id,
        message: m.message,
        createdAt: m.created_at,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Get chat messages error');
    res.status(500).json({ error: 'Failed to get chat messages' });
  }
});

/**
 * POST /api/chat
 * Send a chat message
 */
router.post('/', authRequired, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = sendMessageSchema.parse(req.body);

    const result = run(
      'INSERT INTO chats (user_id, message) VALUES (?, ?)',
      [req.user.id, validatedData.message]
    );

    const messageId = Number(result.lastInsertRowid);

    const message = get<{
      id: number;
      user_id: number;
      message: string;
      created_at: string;
    }>(
      'SELECT id, user_id, message, created_at FROM chats WHERE id = ?',
      [messageId]
    );

    if (!message) {
      throw new Error('Failed to create message');
    }

    logger.info({ messageId, userId: req.user.id }, 'Chat message created');

    res.status(201).json({
      id: message.id,
      userId: message.user_id,
      message: message.message,
      createdAt: message.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Send message error');
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
