// server/index.ts
import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { setupVite, serveStatic, log } from './vite.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware, logger } from './middleware/logging.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { initializeSocket } from './socket.js';
import { wireRequestLogs, wireLogsNamespace } from './logs.js';
import deployQueue from './routes/deploy.queue.js';

// Sentry (v7/v8/v10 compatible)
import * as Sentry from '@sentry/node';

// Fail fast if JWT_SECRET is missing (loads from server/config.ts)
import './config.js';

// ---- Sentry init (after dotenv) ----
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV,
  release: process.env.RENDER_GIT_COMMIT || 'local',
  tracesSampleRate: 0.1,
});

logger.info(`[SENTRY] server DSN present: ${Boolean(process.env.SENTRY_DSN)}`);
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

  // Security headers (CSP allows Sentry beacons; fonts optional; Razorpay only in live)
  if (process.env.NODE_ENV === 'production') {
    const directives: Record<string, string[]> = {
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'connect-src': ["'self'", 'https://*.sentry.io'],
      'img-src': ["'self'", 'https:', 'data:'],
    };

    if (RAZORPAY_MODE === 'live') {
      // When you flip to live payments, allow Razorpay endpoints
      directives['script-src'].push('https://checkout.razorpay.com');
      directives['connect-src'].push('https://api.razorpay.com');
    }
    // While in mock mode, Razorpay stays blocked (no additions)

    app.use(
      helmet({
        contentSecurityPolicy: {
          useDefaults: true,
          directives,
        },
      }),
    );
  } else {
    app.use(helmet({ contentSecurityPolicy: false }));
  }

  // CORS + parsers
  app.use(cors());
  app.use(cookieParser()); // <-- cookie support for session/team routes
  app.use('/webhooks/razorpay', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Previews directory (ensure and reuse same path everywhere)
  const PREVIEWS_DIR = path.resolve(process.env.PREVIEWS_DIR || 'previews');
  if (!fs.existsSync(PREVIEWS_DIR)) fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
  logger.info(`[PREVIEWS] Serving static previews from ${PREVIEWS_DIR}`);

  // Serve /previews as static (so /previews/forks/<id>/index.html resolves)
  // only serve the actual forked sites, not the /previews page
  app.use(
    '/previews/forks',
    express.static(path.join(PREVIEWS_DIR, 'forks'), { extensions: ['html'] })
  );

  // Observability + rate limiting
  app.use(requestIdMiddleware);

  // Echo request id back to client
  app.use((req: any, res, next) => {
    const id = (req as any).id || (req as any).requestId;
    if (typeof id !== 'undefined' && id !== null) res.setHeader('X-Request-ID', String(id));
    next();
  });

  app.use(rateLimiter);

  // ---- Create server + Socket early (before routers) ----
  const server = createServer(app);
  const io = initializeSocket(server) as any;
  if (io) {
    app.set('io', io);
    wireLogsNamespace(io);
    wireRequestLogs(app, io); // attaches BEFORE routers for full coverage
    logger.info('[SOCKET.IO] Real-time server initialized');

    // --- Presence (in-memory) ---
    type Peer = { id: string; name: string; color: string; file?: string; ts: number };
    const presence = new Map<string, Map<string, Peer>>(); // room -> peerId -> Peer

    function emitPresence(ioInst: any, room: string) {
      const peers = Array.from(presence.get(room)?.values() || []);
      ioInst.to(room).emit('collab:presence:update', { room, peers });
    }

    io.on('connection', (socket: any) => {
      let room: string | null = null;
      const peerId = socket.id;

      socket.on(
        'collab:join',
        ({ room: r, user }: { room: string; user: { name?: string; color?: string } }) => {
          room = r;
          socket.join(r);
          const peers = presence.get(r) || new Map<string, Peer>();
          peers.set(peerId, {
            id: peerId,
            name: user?.name || 'Guest',
            color: user?.color || '#8b5cf6',
            ts: Date.now(),
          });
          presence.set(r, peers);
          emitPresence(io, r);
        }
      );

      socket.on('collab:presence', ({ file }: { file?: string }) => {
        if (!room) return;
        const peers = presence.get(room);
        if (!peers) return;
        const p = peers.get(peerId);
        if (!p) return;
        p.ts = Date.now();
        if (file) p.file = file;
        peers.set(peerId, p);
        presence.set(room, peers);
        emitPresence(io, room);
      });

      socket.on('collab:comment:broadcast', (payload: any) => {
        if (room) socket.to(room).emit('collab:comment:event', payload);
      });

      // --- cursor relay ---
      socket.on('collab:cursor', (payload: any) => {
        // payload: { file?: string, startLine?: number, endLine?: number }
        if (room) {
          io.to(room).emit('collab:cursor:update', {
            peerId,
            ...payload,
            ts: Date.now(),
          });
        }
      });

      // --- mention relay ---
      socket.on('collab:mention', (payload: any) => {
        // payload: { toName: string, from: { name, color }, previewPath, file, commentId }
        if (room) {
          io.to(room).emit('collab:mention', payload);
        }
      });

      // --- explicit leave handler ---
      socket.on('collab:leave', ({ room: r }: { room: string }) => {
        if (room === r) {
          const peers = presence.get(room);
          if (peers) {
            peers.delete(peerId);
            presence.set(room, peers);
            emitPresence(io, room);
          }
          socket.leave(room);
          room = null;
        }
      });

      socket.on('disconnect', () => {
        if (!room) return;
        const peers = presence.get(room);
        if (!peers) return;
        peers.delete(peerId);
        presence.set(room, peers);
        emitPresence(io, room);
      });
    });

    // prune stale peers every 60s
    setInterval(() => {
      const now = Date.now();
      for (const [room, peers] of presence.entries()) {
        let changed = false;
        for (const [id, p] of peers.entries()) {
          if (now - p.ts > 90_000) {
            peers.delete(id);
            changed = true;
          }
        }
        if (changed) {
          presence.set(room, peers);
          emitPresence(io, room); // notify clients after pruning
        }
      }
    }, 60_000);
  }

  // Health checks (early)
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Default app settings for the client
  app.get('/api/settings', (_req: Request, res: Response) => {
    res.json({
      version: '1',
      themeDefault: 'system',
      currencyDefault: 'INR',
      payments: { razorpayMode: process.env.RAZORPAY_MODE || 'mock' },
    });
  });

  // Return a key in live mode, or a harmless JSON in mock mode
  app.get('/api/razorpay_key', (_req: Request, res: Response) => {
    if (process.env.RAZORPAY_MODE === 'live') {
      return res.json({ key: process.env.RAZORPAY_KEY_ID || null });
    }
    // mock mode: don't throw, just return a clear payload
    return res.json({ mock: true, key: null });
  });

  // --- Add: fork a preview template into a unique slug under /previews/forks/<slug> ---
  app.post('/api/previews/fork', async (req: Request, res: Response) => {
    try {
      const sourceId = String((req.body as any)?.sourceId || '').trim();

      // basic guard: only simple slugs
      if (!/^[a-z0-9-]+$/i.test(sourceId)) {
        return res.status(400).json({ error: 'invalid sourceId' });
      }

      const sourceDir = path.join(PREVIEWS_DIR, sourceId);
      const indexPath = path.join(sourceDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        return res.status(404).json({ error: 'template not found' });
      }

      const forksDir = path.join(PREVIEWS_DIR, 'forks');
      await fs.promises.mkdir(forksDir, { recursive: true });

      const slug = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${sourceId}`;
      const destDir = path.join(forksDir, slug);

      // Node 22 has fs.promises.cp
      await fs.promises.cp(sourceDir, destDir, { recursive: true });

      const publicPath = `/previews/forks/${slug}/`;
      return res.json({ path: publicPath });
    } catch (err) {
      return res.status(500).json({ error: 'fork failed' });
    }
  });

  // TEMP test route for Sentry server (gated)
  if (process.env.ENABLE_TEST_ROUTES === 'true') {
    app.get('/api/boom', () => {
      throw new Error('boom');
    });
  }

  // API routers
  const { default: jobsRouter } = await import('./routes/jobs.js');
  const { default: workspaceRouter } = await import('./routes/workspace.js');

  const { default: authRoutes } = await import('./routes/auth.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: projectsRoutes } = await import('./routes/projects.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: chatRoutes } = await import('./routes/chat.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: executeRoutes } = await import('./routes/execute.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: previewsRouter } = await import('./routes/previews.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: exportRouter } = await import('./routes/export.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: deployRouter } = await import('./routes/deploy.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: tasksRouter } = await import('./routes/tasks.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: scaffoldRouter } = await import('./routes/scaffold.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: importRouter } = await import('./routes/import.js').catch(() => ({
    default: undefined as any,
  }));
  const { default: previewsManage } = await import('./routes/previews.manage.js').catch(() => ({
    default: undefined as any,
  }));
  // NEW: AI orchestrator (mounted near other routers)
  const { default: aiOrchestrator } = await import('./routes/ai.orchestrator.js').catch(() => ({
    default: undefined as any,
  }));
  // NEW: AI review router (server/ai/router.js)
  const { default: aiRouter } = await import('./ai/router.js').catch(() => ({
    default: undefined as any,
  }));

  // CJS dynamic-import interop (comments + qna)
  const commentsMod: any = await import('./routes/comments.js')
    .then((m) => (m as any).default ?? m)
    .catch(() => ({} as any));
  const aiqnaMod: any = await import('./routes/ai.qna.js')
    .then((m) => (m as any).default ?? m)
    .catch(() => ({} as any));

  // Optional routes: previews.remove-file + teams
  const previewsRemoveMod: any = await import('./routes/previews.remove-file.js').catch(() => ({} as any));
  const teamsMod: any = await import('./routes/teams.js').catch(() => ({} as any));

  // Mount deploy queue router (in addition to deploy API)
  app.use('/api/deploy', deployQueue);

  if (authRoutes) app.use('/api/auth', authRoutes);
  if (projectsRoutes) app.use('/api/projects', projectsRoutes);
  if (chatRoutes) app.use('/api/chat', chatRoutes);
  if (executeRoutes) app.use('/api/execute', executeRoutes);
  if (previewsRouter) app.use('/api/previews', express.json(), previewsRouter);
  if (exportRouter) app.use('/api/previews', express.json(), exportRouter);
  if (deployRouter) app.use('/api/deploy', express.json({ limit: '5mb' }), deployRouter);
  if (tasksRouter) app.use('/api/tasks', express.json(), tasksRouter);
  if (scaffoldRouter) app.use('/api/scaffold', express.json(), scaffoldRouter);
  if (importRouter) app.use('/api/import', express.json({ limit: '2mb' }), importRouter);
  if (previewsManage) app.use('/api/previews', express.json(), previewsManage);

  // Mount AI routers UNDER THE SAME PREFIX. Order matters:
  // - Mount aiRouter (with /review) first so it takes precedence over any duplicate paths.
  if (aiRouter) app.use('/api/ai', express.json({ limit: '1mb' }), aiRouter);
  if (aiOrchestrator) app.use('/api/ai', aiOrchestrator); // planner/scaffold endpoints

  // Comments API
  if (commentsMod?.list) app.get('/api/comments/list', commentsMod.list);
  if (commentsMod?.add) app.post('/api/comments/add', express.json(), commentsMod.add);
  if (commentsMod?.resolve) app.post('/api/comments/resolve', express.json(), commentsMod.resolve);
  if (commentsMod?.remove) app.post('/api/comments/remove', express.json(), commentsMod.remove); // optional remove

  // AI Q&A
  if (aiqnaMod?.qna) app.post('/api/ai/qna', express.json(), aiqnaMod.qna);

  // Previews: remove-file endpoint
  if (previewsRemoveMod?.removeFile) {
    app.post('/api/previews/remove-file', express.json(), previewsRemoveMod.removeFile);
  } else if (previewsRemoveMod?.default) {
    // fallback to a router if provided as default
    app.use('/api/previews', express.json(), previewsRemoveMod.default);
  }

  // Teams/session endpoints (optional)
  if (teamsMod?.session) app.get('/api/session', teamsMod.session);
  if (teamsMod?.create) app.post('/api/teams', express.json(), teamsMod.create);
  if (teamsMod?.mine) app.get('/api/teams/mine', teamsMod.mine);
  if (teamsMod?.switch) app.post('/api/teams/switch', express.json(), teamsMod.switch);
  if (teamsMod?.invite) app.post('/api/teams/invite', express.json(), teamsMod.invite);
  if (teamsMod?.accept) app.post('/api/teams/accept', express.json(), teamsMod.accept);

  app.use('/api', jobsRouter);
  app.use('/api', workspaceRouter);

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
    (Sentry as any).expressErrorHandler?.() || (Sentry as any).Handlers?.errorHandler?.();
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
