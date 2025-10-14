import 'dotenv/config';

// Fail fast if JWT_SECRET is missing (loads from server/config.ts)
import "./config.js";

import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import fs from "fs";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { requestIdMiddleware, logger } from './middleware/logging.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import chatRoutes from './routes/chat.js';
import executeRoutes from './routes/execute.js';

// Log that JWT_SECRET is configured (config.ts already validated it)
logger.info('[SECURITY] JWT_SECRET is configured and validated');

// Razorpay mode validation
const RAZORPAY_MODE = process.env.RAZORPAY_MODE || 'mock';
if (RAZORPAY_MODE === 'live') {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID/SECRET required in live mode');
  }
}
logger.info(`[RAZORPAY] Mode: ${RAZORPAY_MODE}`);

const app = express();

(async () => {
  // Ensure data directory exists
  const dataDir = './data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize SQLite database (imported as singleton)
  const DATABASE_FILE = process.env.DATABASE_FILE || './data/app.db';
  logger.info(`[DB] Using SQLite database at ${DATABASE_FILE}`);

  // Security headers
  app.use(helmet());
  
  // CORS support
  app.use(cors());

  // Capture raw body for webhook signature verification
  app.use('/webhooks/razorpay', express.raw({ type: 'application/json' }));

  // Body parsing (limit 1MB)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Request ID middleware (before logging)
  app.use(requestIdMiddleware);

  // Rate limiting (100 req/min per IP)
  app.use(rateLimiter);

  // Health check routes
  app.get('/api/status', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Mount modular routes (no db parameter needed - routes import SQLite directly)
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/execute', executeRoutes);

  // Create HTTP server
  const server = createServer(app);

  // Setup Vite in development or serve static files in production
  const isDev = process.env.NODE_ENV === "development" || app.get("env") === "development";
  if (isDev) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Centralized error handling middleware (must be last)
  app.use(errorHandler);

  // Server startup with port retry logic
  async function startServer(attemptPort: number, maxAttempts: number = 3): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentPort = attemptPort + attempt;
      
      try {
        await new Promise<void>((resolve, reject) => {
          const listener = server.listen({
            port: currentPort,
            host: "0.0.0.0",
            reusePort: true,
          }, () => {
            log(`serving on port ${currentPort}`);
            logger.info(`[SERVER] Successfully started on port ${currentPort}`);
            resolve();
          });

          listener.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
              logger.warn(`[SERVER] Port ${currentPort} is busy, trying next port...`);
              reject(err);
            } else {
              reject(err);
            }
          });
        });
        
        // If we get here, server started successfully
        return;
      } catch (err: any) {
        if (err.code === 'EADDRINUSE' && attempt < maxAttempts - 1) {
          // Try next port
          continue;
        } else {
          // Last attempt failed or different error
          logger.error(`[SERVER] Failed to start server:`, err);
          throw err;
        }
      }
    }
    
    throw new Error(`Failed to start server after ${maxAttempts} attempts`);
  }

  // Start server
  const port = parseInt(process.env.PORT || '5000', 10);
  await startServer(port);
})();
