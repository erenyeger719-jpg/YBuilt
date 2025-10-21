// server/logs.js
import { EventEmitter } from "events";

export const logsBus = new EventEmitter();

function durationMs(startNs) {
  const diff = process.hrtime.bigint() - startNs;
  return Math.round(Number(diff) / 1e6);
}

export function wireRequestLogs(app, io) {
  // Emits one event per HTTP request when it finishes
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      // be generous pulling a request id (your middleware likely sets one)
      const reqId =
        (req.id && String(req.id)) ||
        String(res.getHeader?.("x-request-id") || req.headers["x-request-id"] || "");

      const payload = {
        ts: Date.now(),
        kind: "request",
        level:
          res.statusCode >= 500 ? "error" :
          res.statusCode >= 400 ? "warn"  : "info",
        reqId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        ms: durationMs(start),
        ip: req.ip,
        ua: req.headers["user-agent"] || "",
      };

      logsBus.emit("log", payload);
      try { io?.of("/logs").emit("log:server", payload); } catch {}
      if (reqId) {
        try { io?.of("/logs").to(`req:${reqId}`).emit("log:server", payload); } catch {}
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

    // client → server browser log bridge (optional but handy)
    socket.on("client:log", (p) => {
      const payload = {
        ts: Date.now(),
        kind: "client",
        level: p?.level || "error",
        message: p?.message || "",
        stack: p?.stack || "",
        path: p?.path || "",
        reqId: p?.reqId || "",
      };
      logsBus.emit("log", payload);
      ns.emit("log:client", payload);
      if (payload.reqId) ns.to(`req:${payload.reqId}`).emit("log:client", payload);
    });
  });
}
