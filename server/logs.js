// server/logs.js
import { EventEmitter } from "events";

export const logsBus = new EventEmitter();

function durationMs(startNs) {
  const diff = process.hrtime.bigint() - startNs;
  return Math.round(Number(diff) / 1e6);
}

function pickRequestId(req, res) {
  // Try several common places middleware may stash a request id
  const fromHeader =
    (typeof res.getHeader === "function" && (res.getHeader("x-request-id") || res.getHeader("X-Request-ID"))) ||
    req.headers?.["x-request-id"];
  return (
    (req.id && String(req.id)) ||
    (req.requestId && String(req.requestId)) ||
    (fromHeader && String(fromHeader)) ||
    ""
  );
}

export function wireRequestLogs(app, io) {
  // Emits one event per HTTP request when it finishes
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const rid = pickRequestId(req, res);

      const payload = {
        ts: Date.now(),
        kind: "request", // legacy field
        type: "request", // alias for consumers expecting `type`
        level:
          res.statusCode >= 500 ? "error" :
          res.statusCode >= 400 ? "warn"  : "info",
        // include both `rid` (new) and `reqId` (back-compat)
        rid,
        reqId: rid,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        ms: durationMs(start),
        ip: req.ip,
        ua: req.headers["user-agent"] || "",
      };

      // Internal event bus
      logsBus.emit("log", payload);

      // Socket.IO broadcasts (namespace: /logs)
      try {
        const ns = io?.of("/logs");
        if (ns) {
          // Keep existing event name for back-compat
          ns.emit("log:server", payload);
          // Also emit the new event expected by some consumers
          ns.emit("server:req", payload);

          // If we have a request id, also target a room for that request
          if (rid) {
            ns.to(`req:${rid}`).emit("log:server", payload);
            ns.to(`req:${rid}`).emit("server:req", payload);
          }
        }
      } catch {
        // swallow — logging should never crash the app
      }
    });

    next();
  });
}

export function wireLogsNamespace(io) {
  const ns = io.of("/logs");

  ns.on("connection", (socket) => {
    // optional: follow a specific request id
    socket.on("join-req", (reqId) => {
      if (reqId) socket.join(`req:${reqId}`);
    });
    // alias for clarity if clients prefer `join-rid`
    socket.on("join-rid", (rid) => {
      if (rid) socket.join(`req:${rid}`);
    });

    // 1) Client request rows (from client fetch bridge)
    socket.on("client:req", (p = {}) => {
      const rid = p.rid || "";
      const row = {
        ts: Date.now(),
        kind: "client",
        type: "client-request",
        level: "info",
        rid,
        reqId: rid,
        method: p.method,
        path: p.path,
        status: p.status,
        ms: p.ms,
        message: p.error ? String(p.error) : undefined,
      };
      logsBus.emit("log", row);
      ns.emit("log:client", row);
      if (rid) ns.to(`req:${rid}`).emit("log:client", row);
    });

    // 2) Client error rows (uncaught + unhandledrejection)
    socket.on("client:error", (p = {}) => {
      const rid = p.rid || p.reqId || "";
      const row = {
        ts: Date.now(),
        kind: "client",
        type: p.type || "client-error",
        level: "error",
        rid,
        reqId: rid,
        message: p.message || "",
        stack: p.stack || "",
        path: p.path || "",
      };
      logsBus.emit("log", row);
      ns.emit("log:client", row);
      if (rid) ns.to(`req:${rid}`).emit("log:client", row);
    });

    // client → server browser log bridge (optional but handy)
    // (Kept for back-compat)
    socket.on("client:log", (p = {}) => {
      const rid = p?.rid || p?.reqId || "";
      const payload = {
        ts: Date.now(),
        kind: "client",
        type: "client",
        level: p.level || "error",
        message: p.message || "",
        stack: p.stack || "",
        path: p.path || "",
        // include both for symmetry with server payloads
        rid,
        reqId: rid,
      };

      // Emit on process bus
      logsBus.emit("log", payload);

      // Broadcast to all listeners and, if present, the per-request room
      ns.emit("log:client", payload);
      if (rid) ns.to(`req:${rid}`).emit("log:client", payload);
    });
  });
}
