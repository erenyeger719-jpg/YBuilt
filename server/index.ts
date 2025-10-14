import express, { type Request, Response, NextFunction } from "express";
import morgan from "morgan";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

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

// Capture raw body for webhook signature verification
app.use('/webhooks/razorpay', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Morgan HTTP request logging
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  skip: (req) => req.path.startsWith('/assets') || req.path.startsWith('/src'),
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Centralized error handling middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error with context
    logger.error(`[ERROR] ${req.method} ${req.path} - ${status}: ${message}`, {
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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
