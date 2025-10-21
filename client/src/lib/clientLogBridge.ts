import { io } from "socket.io-client";

const sock = io("/logs", { autoConnect: true });

window.addEventListener("error", (e) => {
  sock.emit("client:log", {
    level: "error",
    message: e.message,
    stack: e.error?.stack || "",
    path: window.location.pathname,
  });
});

window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  sock.emit("client:log", {
    level: "error",
    message: String(e.reason),
    path: window.location.pathname,
  });
});
