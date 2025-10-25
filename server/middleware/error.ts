import { logger } from './logging.js';

export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function notifyWebhook(payload) {
  const url = process.env.ALERT_WEBHOOK_URL || '';
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const isDev = process.env.NODE_ENV !== 'production';
  const rid = (res.getHeader('X-Request-ID') || req.headers['x-request-id'] || '') + '';
  const msg = err?.message || (statusCode >= 500 ? 'Something went wrong.' : 'Request error.');

  logger.error(
    { rid, error: err?.message, stack: isDev ? err?.stack : undefined, statusCode, path: req.path, method: req.method },
    'Request error'
  );

  if (statusCode >= 500) {
    notifyWebhook({ kind: 'server_error', rid, path: req.path, method: req.method, statusCode, message: err?.message || 'error', ts: Date.now() });
  }

  const payload = {
    ok: false,
    error: statusCode >= 500 ? 'server_error' : 'request_error',
    message: isDev ? msg : (statusCode >= 500 ? 'Something went wrong.' : 'Request error.'),
    rid,
  };
  if (err instanceof HttpError && err.details) payload.details = err.details;
  if (isDev && err?.stack) payload.stack = err.stack;

  if (req.path.startsWith('/api/')) {
    res.status(statusCode).json(payload);
  } else {
    res.status(statusCode).type('text/plain').send(statusCode >= 500 ? '500 — Something went wrong.' : 'Request error.');
  }
}

export function notFoundHandler(req, res, next) {
  if (!req.path.startsWith('/api/')) return next(new HttpError(404, `Not found: ${req.method} ${req.path}`));
  const rid = (res.getHeader('X-Request-ID') || req.headers['x-request-id'] || '') + '';
  return res.status(404).json({ ok: false, error: 'not_found', message: 'No such API route.', rid });
}
