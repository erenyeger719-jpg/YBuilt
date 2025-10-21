import { io } from "socket.io-client";

const sock = io("/logs", { transports: ["websocket"] });

// Uncaught errors → logs
window.addEventListener("error", (e) => {
  sock.emit("client:error", {
    ts: Date.now(),
    type: "client-error",
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    stack: e.error?.stack,
  });
});

window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  const reason = (e as any).reason;
  sock.emit("client:error", {
    ts: Date.now(),
    type: "client-unhandled-rejection",
    message: String(reason?.message || reason),
    stack: reason?.stack,
  });
});

// Fetch wrapper → emits request rows with Request-ID
const _fetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const t0 = performance.now();
  let method = (init?.method || (input as any)?.method || "GET").toUpperCase();
  let url = typeof input === "string" ? input : (input as any).url || String(input);

  try {
    const res = await _fetch(input as any, init);
    const rid = res.headers.get("x-request-id");
    const ms = Math.max(0, Math.round(performance.now() - t0));
    sock.emit("client:req", {
      ts: Date.now(),
      type: "client-request",
      rid,
      method,
      path: new URL(url, window.location.origin).pathname + (new URL(url, window.location.origin).search || ""),
      status: res.status,
      ms,
    });
    return res;
  } catch (err: any) {
    const ms = Math.max(0, Math.round(performance.now() - t0));
    sock.emit("client:req", {
      ts: Date.now(),
      type: "client-request",
      rid: undefined,
      method,
      path: new URL(url, window.location.origin).pathname,
      status: 0,
      ms,
      error: String(err?.message || err),
    });
    throw err;
  }
};
