import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { rateLimiter } from "./middleware/rateLimiter";
import { initDb } from './db.js';
import { requestIdMiddleware, requestLogger } from './middleware/logging.js';
import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import chatRoutes from './routes/chat.js';
import executeRoutes from './routes/execute.js';

// LOG_LEVEL support
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const levels: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const currentLevel = levels[LOG_LEVEL] || levels.INFO;

export const logger = {
  debug: (...args: any[]) => currentLevel <= 0 && console.log('[DEBUG]', ...args),
  info: (...args: any[]) => currentLevel <= 1 && console.log('[INFO]', ...args),
  warn: (...args: any[]) => currentLevel <= 2 && console.warn('[WARN]', ...args),
  error: (...args: any[]) => currentLevel <= 3 && console.error('[ERROR]', ...args)
};

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

  // Initialize database
  const DATABASE_FILE = process.env.DATABASE_FILE || './data/db.json';
  const db = await initDb(DATABASE_FILE);
  logger.info('[DB] Database initialized at', DATABASE_FILE);

  // Security headers
  app.use(helmet());
  
  // CORS support
  app.use(cors());

  // Capture raw body for webhook signature verification
  app.use('/webhooks/razorpay', express.raw({ type: 'application/json' }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Request ID middleware (before logging)
  app.use(requestIdMiddleware);

  // Request logger (after requestId)
  app.use(requestLogger);

  // Morgan HTTP request logging (simplified since requestLogger handles basic logging)
  const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat, {
    skip: (req) => req.path.startsWith('/assets') || req.path.startsWith('/src'),
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  // Rate limiting (100 req/min per IP)
  app.use(rateLimiter);

  // Health check route
  app.get('/api/status', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Mount modular routes
  app.use('/api/auth', authRoutes(db));
  app.use('/api/projects', projectsRoutes(db));
  app.use('/api/chat', chatRoutes(db));
  app.use('/api/execute', executeRoutes(db));

  // Create HTTP server
  const server = createServer(app);

  // Centralized error handling middleware (enhanced with req.id)
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error with context including request ID if available
    logger.error(`[ERROR] ${req.method} ${req.path} - ${status}: ${message}`, {
      requestId: (req as any).id,
      error: err.stack,
      userId: (req as any).user?.id,
      body: req.body,
    });

    // Don't expose internal errors in production
    const clientMessage = process.env.NODE_ENV === 'production' && status === 500
      ? "Internal Server Error"
      : message;

    res.status(status).json({ 
      error: clientMessage,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
  });

  // Setup Vite in development or serve static files in production
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

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
