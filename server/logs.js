// server/logs.js
import { EventEmitter } from "events";

export const logsBus = new EventEmitter();

/* ----------------------------- tiny utils ----------------------------- */
function durationMs(startNs) {
  const diff = process.hrtime.bigint() - startNs;
  return Math.round(Number(diff) / 1e6);
}
function pickRequestId(req, res) {
  const fromHeader =
    (typeof res.getHeader === "function" &&
      (res.getHeader("x-request-id") || res.getHeader("X-Request-ID"))) ||
    req.headers?.["x-request-id"];
  return (
    (req.id && String(req.id)) ||
    (req.requestId && String(req.requestId)) ||
    (fromHeader && String(fromHeader)) ||
    ""
  );
}

/* ----------------------------- history buffer ----------------------------- */
const HISTORY_CAP = 500;
const _history = [];
function pushHistory(row) {
  _history.push(row);
  if (_history.length > HISTORY_CAP) _history.shift();
}
export function recentLogs(n = 100) {
  return _history.slice(-Math.max(0, n));
}
export function findByRequestId(id) {
  const needle = String(id || "");
  if (!needle) return [];
  return _history.filter(
    (r) => r?.rid === needle || r?.reqId === needle || r?.requestId === needle
  );
}

/* ----------------------------- canonical shape ----------------------------- */
function toEvent(row) {
  // Normalize to a single shape
  return {
    ts: row.ts ?? Date.now(),
    level: row.level || "info",           // info|warn|error
    type: row.type || row.kind || "log",  // request|http:done|client-error|client-request|client|exec|log
    source: row.source || (row.kind === "client" ? "client" : "server"),
    rid: row.rid || row.reqId || row.requestId || "",
    method: row.method || "",
    path: row.path || "",
    status: typeof row.status === "number" ? row.status : undefined,
    ms: typeof row.ms === "number" ? row.ms : undefined,
    message: row.message,
    stack: row.stack,
    ip: row.ip,
    ua: row.ua,
    extras: row.extras, // optional bucket for odd fields
  };
}

/** Broadcast + store a canonical event */
export function logEvent(io, row) {
  const ev = toEvent(row);
  pushHistory(ev);
  // Fan-out: one canonical event + old back-compat events
  const ns = io?.of?.("/logs");
  if (ns) {
    ns.emit("log:event", ev);
    if (ev.source === "server") ns.emit("log:server", ev);
    else ns.emit("log:client", ev);

    // per-request room
    if (ev.rid) {
      ns.to(`req:${ev.rid}`).emit("log:event", ev);
      if (ev.source === "server") ns.to(`req:${ev.rid}`).emit("log:server", ev);
      else ns.to(`req:${ev.rid}`).emit("log:client", ev);
    }
  }
  // process bus for any local listeners
  logsBus.emit("log", ev);
}

/* ----------------------------- request wiring ----------------------------- */
export function wireRequestLogs(app, io) {
  app.use((req, res, next) => {
    const startNs = process.hrtime.bigint();
    const startWall = Date.now();

    res.on("finish", () => {
      const rid = pickRequestId(req, res);
      const payload = {
        ts: Date.now(),
        source: "server",
        type: "request",
        level:
          res.statusCode >= 500 ? "error" :
          res.statusCode >= 400 ? "warn"  : "info",
        rid,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        ms: durationMs(startNs),
        ip: req.ip,
        ua: req.headers["user-agent"] || "",
      };

      logEvent(io, payload);

      // Also emit http:done as a distinct type (kept for tools expecting it)
      const httpDone = {
        ts: Date.now(),
        source: "server",
        type: "http:done",
        level: payload.level,
        rid,
        method: payload.method,
        path: payload.path,
        status: payload.status,
        ms: Math.max(0, Date.now() - startWall),
      };
      logEvent(io, httpDone);
    });

    next();
  });
}

/* ----------------------------- namespace wiring ----------------------------- */
export function wireLogsNamespace(io) {
  const ns = io.of("/logs");

  ns.on("connection", (socket) => {
    // Backfill last 100 in canonical shape
    try {
      socket.emit("history", recentLogs(100));
    } catch {}

    // Follow a specific request id (two aliases)
    socket.on("join-req", (reqId) => {
      if (reqId) socket.join(`req:${reqId}`);
    });
    socket.on("join-rid", (rid) => {
      if (rid) socket.join(`req:${rid}`);
    });

    // Client → server request rows
    socket.on("client:req", (p = {}) => {
      const rid = p.rid || "";
      logEvent(io, {
        ts: Date.now(),
        source: "client",
        type: "client-request",
        level: "info",
        rid,
        method: p.method,
        path: p.path,
        status: p.status,
        ms: p.ms,
        message: p.error ? String(p.error) : undefined,
      });
    });

    // Client errors
    socket.on("client:error", (p = {}) => {
      const rid = p.rid || p.reqId || "";
      logEvent(io, {
        ts: Date.now(),
        source: "client",
        type: p.type || "client-error",
        level: "error",
        rid,
        message: p.message || "",
        stack: p.stack || "",
        path: p.path || "",
      });
    });

    // Client console bridge (legacy)
    socket.on("client:log", (p = {}) => {
      const rid = p?.rid || p?.reqId || "";
      logEvent(io, {
        ts: Date.now(),
        source: "client",
        type: "client",
        level: p.level || "error",
        message: p.message || "",
        stack: p.stack || "",
        path: p.path || "",
        rid,
      });
    });
  });
}
