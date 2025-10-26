import type { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

export function notFoundHandler(req: Request, res: Response) {
  const rid = (res.getHeader('X-Request-ID') || req.headers['x-request-id'] || '') + '';
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      ok: false,
      error: 'not_found',
      message: 'No such API route.',
      rid,
    });
  }
  res.status(404).send(
    `404 — Not found\n\nThis page doesn’t exist.\nRequest ID: ${rid}\n`
  );
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const rid = (res.getHeader('X-Request-ID') || req.headers['x-request-id'] || '') + '';
  const status = Number(err?.status || err?.statusCode || 500);
  const isApi = req.path.startsWith('/api');
  const msg = status >= 500
    ? 'Something went wrong on our side.'
    : (String(err?.message || 'Bad request.'));

  // Sentry (if DSN is set)
  try { Sentry.captureException?.(err); } catch {}

  // 🔔 Fallback alert to Slack/Discord via webhook (works even if Sentry DSN is empty)
  try {
    const url = process.env.SENTRY_ALERT_WEBHOOK || process.env.ALERT_WEBHOOK || '';
    if (url && status >= 500) {
      const payload = {
        text:
          `🚨 Server ${status} — ${msg}\n` +
          `path=${req.path} rid=${rid}\n` +
          `env=${process.env.NODE_ENV} release=${process.env.RENDER_GIT_COMMIT || 'local'}`,
        content:
          `🚨 Server ${status} — ${msg}\n` +
          `path=${req.path} rid=${rid}\n` +
          `env=${process.env.NODE_ENV} release=${process.env.RENDER_GIT_COMMIT || 'local'}`,
      };
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch {}

  if (isApi) {
    return res.status(status).json({
      ok: false,
      error: status >= 500 ? 'server_error' : 'client_error',
      message: msg,
      rid,
    });
  }

  res.status(status).send(
    `${status >= 500 ? '500 — Server error' : `${status} — Error`}\n\n${msg}\nRequest ID: ${rid}\n`
  );
}
