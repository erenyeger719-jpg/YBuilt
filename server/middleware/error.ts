export function errorHandler(err, req, res, next) {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const isDev = process.env.NODE_ENV !== 'production';
  const rid = (res.getHeader('X-Request-ID') || req.headers['x-request-id'] || '') + '';
  const message = err?.message || (statusCode >= 500 ? 'Something went wrong.' : 'Request error.');

  // log with rid
  logger.error(
    {
      rid,
      error: err?.message,
      stack: isDev ? err?.stack : undefined,
      statusCode,
      path: req.path,
      method: req.method,
    },
    'Request error'
  );

  const payload = {
    ok: false,
    error: statusCode >= 500 ? 'server_error' : 'request_error',
    message: isDev ? message : (statusCode >= 500 ? 'Something went wrong.' : 'Request error.'),
    rid,
  };

  if (err instanceof HttpError && err.details) payload.details = err.details;
  if (isDev && err?.stack) payload.stack = err.stack;

  if (req.path.startsWith('/api/')) {
    res.status(statusCode).json(payload);
  } else {
    res
      .status(statusCode)
      .type('text/plain')
      .send(statusCode >= 500 ? '500 — Something went wrong.' : 'Request error.');
  }
}

export function notFoundHandler(req, res, next) {
  // for non-API paths, keep your HttpError flow (so it hits errorHandler)
  if (!req.path.startsWith('/api/')) {
    return next(new HttpError(404, `Not found: ${req.method} ${req.path}`));
  }
  // API 404 returns structured JSON here (mirrors the /api catch-all)
  const rid = (res.getHeader('X-Request-ID') || req.headers['x-request-id'] || '') + '';
  return res.status(404).json({
    ok: false,
    error: 'not_found',
    message: 'No such API route.',
    rid,
  });
}
