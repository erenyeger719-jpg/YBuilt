// server/index.ts
import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { setupVite, serveStatic, log } from './vite.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware, logger } from './middleware/logging.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { initializeSocket } from './socket.js';

// Sentry (v7/v8/v10 compatible)
import * as Sentry from '@sentry/node';

// Fail fast if JWT_SECRET is missing (loads from server/config.ts)
import './config.js';

// ---- Sentry init (after dotenv) ----
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  tracesSampleRate: 0.1,
});

// Basic app setup
logger.info('[SECURITY] JWT_SECRET is configured and validated');

const RAZORPAY_MODE = process.env.RAZORPAY_MODE || 'mock';
if (RAZORPAY_MODE === 'live') {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID/SECRET required in live mode');
  }
}
logger.info(`[RAZORPAY] Mode: ${RAZORPAY_MODE}`);

const app = express();

// ---- Sentry request middleware (v7/v8/v10 safe) ----
const reqMw =
  // v8/v10
  (Sentry as any).expressRequestMiddleware?.() ||
  // v7
  (Sentry as any).Handlers?.requestHandler?.();
if (reqMw) app.use(reqMw);

(async () => {
  // Ensure data dir
  const dataDir = './data';
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // DB path log
  const DATABASE_FILE = process.env.DATABASE_FILE || './data/app.db';
  logger.info(`[DB] Using SQLite database at ${DATABASE_FILE}`);

  // Security headers (CSP allows Sentry beacons)
  if (process.env.NODE_ENV === 'production') {
    app.use(
      helmet({
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "connect-src": ["'self'", "https://*.sentry.io"],
            "img-src": ["'self'", "https:", "data:"],
          },
        },
      })
    );
  } else {
    app.use(helmet({ contentSecurityPolicy: false }));
  }

  // CORS + parsers
  app.use(cors());
  app.use('/webhooks/razorpay', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Static previews
  app.use('/previews', express.static(path.resolve(process.env.PREVIEWS_DIR || 'previews')));

  // Observability + rate limiting
  app.use(requestIdMiddleware);
  app.use(rateLimiter);

  // Health checks (early)
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // TEMP test route for Sentry server
  app.get('/api/boom', () => {
    throw new Error('boom');
  });

  // API routers
  const { default: jobsRouter } = await import('./routes/jobs.js');
  const { default: workspaceRouter } = await import('./routes/workspace.js');
  const { default: authRoutes } = await import('./routes/auth.js').catch(() => ({ default: undefined as any }));
  const { default: projectsRoutes } = await import('./routes/projects.js').catch(() => ({ default: undefined as any }));
  const { default: chatRoutes } = await import('./routes/chat.js').catch(() => ({ default: undefined as any }));
  const { default: executeRoutes } = await import('./routes/execute.js').catch(() => ({ default: undefined as any }));

  if (authRoutes)     app.use('/api/auth', authRoutes);
  if (projectsRoutes) app.use('/api/projects', projectsRoutes);
  if (chatRoutes)     app.use('/api/chat', chatRoutes);
  if (executeRoutes)  app.use('/api/execute', executeRoutes);

  app.use('/api', jobsRouter);
  app.use('/api', workspaceRouter);

  // HTTP server (Socket.IO + Vite dev)
  const server = createServer(app);

  // Realtime
  initializeSocket(server);
  logger.info('[SOCKET.IO] Real-time server initialized');

  // Static vs Vite dev (AFTER API)
  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  // 404 last route
  app.use(notFoundHandler);

  // ---- Sentry error middleware (v7/v8/v10 safe) ----
  const errMw =
    (Sentry as any).expressErrorHandler?.() ||
    (Sentry as any).Handlers?.errorHandler?.();
  if (errMw) app.use(errMw);

  // Your centralized error handler (must be last)
  app.use(errorHandler);

  // Start + retry ports
  async function startServer(attemptPort: number, maxAttempts = 3) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentPort = attemptPort + attempt;
      try {
        await new Promise<void>((resolve, reject) => {
          const listener = server.listen({ port: currentPort, host: '0.0.0.0' }, () => {
            log(`serving on port ${currentPort}`);
            logger.info(`[SERVER] Successfully started on port ${currentPort}`);
            resolve();
          });
          listener.on('error', (err: NodeJS.ErrnoException) => reject(err));
        });
        return;
      } catch (e: any) {
        if (e.code === 'EADDRINUSE' && attempt < maxAttempts - 1) continue;
        logger.error(`[SERVER] Failed to start server:`, e);
        throw e;
      }
    }
    throw new Error(`Failed to start server after ${maxAttempts} attempts`);
  }

  const port = parseInt(process.env.PORT || '5050', 10);
  await startServer(port);
})();
