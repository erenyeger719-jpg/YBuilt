import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Database } from '../db.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

// SECURITY: JWT_SECRET must be set - this should be caught at server startup
// but we check again here as defense in depth
if (!process.env.JWT_SECRET) {
  throw new Error(
    'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is required. ' +
    'Generate a secure secret with: openssl rand -base64 32'
  );
}

const JWT_SECRET = process.env.JWT_SECRET;

export default function authRoutes(db: Database) {
  const router = Router();

  // Apply endpoint-specific rate limiter (30 req/min per IP)
  router.use(authRateLimiter);

  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          error: 'Email is required',
        });
      }

      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          error: 'Password is required',
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Invalid email format',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: 'Password must be at least 6 characters long',
        });
      }

      const existingUser = db.data.users.find(u => u.email === email);
      if (existingUser) {
        return res.status(409).json({
          error: 'Email already exists',
        });
      }

      const password_hash = await bcrypt.hash(password, 10);

      const maxId = db.data.users.length > 0
        ? Math.max(...db.data.users.map(u => u.id))
        : 0;
      const newUserId = maxId + 1;

      const newUser = {
        id: newUserId,
        email,
        password_hash,
        created_at: Date.now(),
      };

      db.data.users.push(newUser);
      await db.write();

      const token = jwt.sign(
        { sub: newUserId, email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        user: {
          id: newUser.id,
          email: newUser.email,
        },
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          error: 'Email is required',
        });
      }

      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          error: 'Password is required',
        });
      }

      const user = db.data.users.find(u => u.email === email);
      if (!user) {
        return res.status(401).json({
          error: 'invalid_credentials',
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'invalid_credentials',
        });
      }

      const token = jwt.sign(
        { sub: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  return router;
}
