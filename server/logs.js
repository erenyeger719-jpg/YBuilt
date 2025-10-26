// server/logs.js
import { EventEmitter } from 'events';

export const logsBus = new EventEmitter();
logsBus.setMaxListeners(0);

// level order for comparisons (warn+ etc.)
const LEVELS = ['debug', 'info', 'warn', 'error'];
function normLevel(l) {
  const x = String(l || '').toLowerCase();
  return LEVELS.includes(x) ? x : 'info';
}

/** Normalize any row into one stable shape */
export function normalizeLog(row = {}) {
  const ts = typeof row.ts === 'number' ? row.ts : Date.now();
  const level = normLevel(row.level);
  const source = String(row.source || 'server');
  const type = String(row.type || 'log');

  const ev = {
    ts,
    level,                // "debug" | "info" | "warn" | "error"
    source,               // "http" | "exec" | "build" | "palette" | "server" | ...
    type,                 // "request" | "sandbox" | "build" | "command" | "log"
    rid: String(row.rid || ''),

    // HTTP-ish fields
    method: row.method ? String(row.method) : '',
    path: row.path ? String(row.path) : '',
    status: typeof row.status === 'number' ? row.status : undefined,
    ms: typeof row.ms === 'number' ? row.ms : undefined,

    // Text fields
    message: row.message ? String(row.message) : '',
    stack: row.stack ? String(row.stack) : undefined,

    // Meta (not always present)
    ip: row.ip ? String(row.ip) : undefined,
    ua: row.ua ? String(row.ua) : undefined,
    extras: row.extras ?? undefined,
  };

  return ev;
}

function passesFilters(ev, filt) {
  // level filter: "warn" (exact), or "warn+" (min)
  if (filt.level) {
    const want = String(filt.level).toLowerCase();
    if (want.endsWith('+')) {
      const base = want.slice(0, -1);
      if (!LEVELS.includes(base)) return false;
      if (LEVELS.indexOf(ev.level) < LEVELS.indexOf(base)) return false;
    } else if (LEVELS.includes(want)) {
      if (ev.level !== want) return false;
    }
  }

  // source filter: comma-separated list
  if (filt.source) {
    const set = new Set(String(filt.source).split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
    if (set.size && !set.has(ev.source.toLowerCase())) return false;
  }

  // rid filter: exact match
  if (filt.rid) {
    if (String(ev.rid || '') !== String(filt.rid)) return false;
  }

  return true;
}

/** Socket.IO namespace for live logs with simple filters */
export function wireLogsNamespace(io) {
  const nsp = io.of('/logs');
  nsp.on('connection', (socket) => {
    const filt = {
      level: socket.handshake.query.level || '',   // e.g. "warn+" or "info"
      source: socket.handshake.query.source || '', // e.g. "http,exec"
      rid: socket.handshake.query.rid || '',       // exact rid
    };

    // greet once with active filters
    socket.emit('hello', { ok: true, filters: filt });

    const handler = (row) => {
      const ev = normalizeLog(row);
      if (!passesFilters(ev, filt)) return;
      socket.emit('log', ev);
    };

    logsBus.on('log', handler);
    socket.on('disconnect', () => logsBus.off('log', handler));
  });
}

/** Express request → log row (emits to logsBus) */
export function wireRequestLogs(app /* , io not required */) {
  app.use((req, res, next) => {
    const start = Date.now();
    const ip = req.ip;
    const ua = req.get('user-agent') || '';

    res.on('finish', () => {
      const ms = Date.now() - start;
      const rid = (res.getHeader('X-Request-ID') || req.headers['x-request-id'] || '') + '';
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

      logsBus.emit('log', {
        ts: Date.now(),
        level,
        source: 'http',
        type: 'request',
        rid,
        method: req.method,
        path: req.originalUrl || req.url || '',
        status,
        ms,
        message: `${req.method} ${req.originalUrl || req.url} → ${status}`,
        ip,
        ua,
        extras: {
          resBytes: Number(res.getHeader('content-length') || 0) || undefined,
        },
      });
    });

    next();
  });
}
