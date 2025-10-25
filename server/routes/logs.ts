// server/logs.ts
import type { Express } from "express";
import type { Server as IOServer } from "socket.io";

type ReqLog = {
  ts: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  ip: string;
  ua?: string;
  requestId?: string;
};

const MAX = 500;
const BUF: ReqLog[] = [];

// helpers for REST access
export function recentLogs(limit = 100) {
  const n = Math.max(1, Math.min(limit, MAX));
  return BUF.slice(-n);
}
export function findByRequestId(id: string) {
  if (!id) return [];
  return BUF.filter((e) => e.requestId === id);
}

// Socket namespace + history + follow by requestId
export function wireLogsNamespace(io: IOServer) {
  const nsp = io.of("/logs");
  nsp.on("connection", (socket) => {
    socket.emit("history", recentLogs(100));
    socket.on("follow", (reqId: string) => {
      if (typeof reqId === "string" && reqId) socket.join(`req:${reqId}`);
    });
    socket.on("unfollow", (reqId: string) => {
      if (typeof reqId === "string" && reqId) socket.leave(`req:${reqId}`);
    });
  });
}

// Express middleware that records every request and emits over socket
export function wireRequestLogs(app: Express, io?: IOServer) {
  const nsp = io?.of("/logs");

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const requestId =
        (res.getHeader("X-Request-ID") as string) ||
        (req as any).id ||
        (req as any).requestId;

      const entry: ReqLog = {
        ts: new Date().toISOString(),
        method: req.method,
        path: (req as any).originalUrl || req.url,
        status: res.statusCode,
        ms: Math.round(ms),
        ip:
          ((req.headers["x-forwarded-for"] as string) || "")
            .split(",")[0]
            ?.trim() ||
          (req.ip as string) ||
          "",
        ua: (req.headers["user-agent"] as string) || undefined,
        requestId,
      };

      BUF.push(entry);
      if (BUF.length > MAX) BUF.splice(0, BUF.length - MAX);

      // broadcast + requestId room
      nsp?.emit("http:done", entry);
      if (requestId) nsp?.to(`req:${requestId}`).emit("http:done", entry);
    });
    next();
  });
}
