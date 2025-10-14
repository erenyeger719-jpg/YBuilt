import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { get, run } from '../db/sqlite.js';
import { signJwt, authRequired } from '../middleware/auth.js';
import { logger } from '../middleware/logging.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body);
    const { email, password } = validatedData;

    // Check if user already exists
    const existingUser = get<{ id: number }>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return res.status(409).json({
        error: 'Email already exists',
      });
    }

    // Hash password (bcrypt cost 10)
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = run(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash]
    );

    const userId = Number(result.lastInsertRowid);

    // Get created user
    const user = get<{ id: number; email: string; created_at: string }>(
      'SELECT id, email, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate JWT
    const token = signJwt({
      sub: user.id,
      email: user.email,
    });

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Registration error');
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Get user by email
    const user = get<{ id: number; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({
        error: 'invalid_credentials',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'invalid_credentials',
      });
    }

    // Generate JWT
    const token = signJwt({
      sub: user.id,
      email: user.email,
    });

    logger.info({ userId: user.id, email: user.email }, 'User logged in');

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Login error');
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires auth)
 */
router.get('/me', authRequired, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  res.status(200).json({
    user: {
      id: req.user.id,
      email: req.user.email,
    },
  });
});

export default router;
