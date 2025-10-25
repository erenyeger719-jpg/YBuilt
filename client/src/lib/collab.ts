import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (location.port === "3000" ? "http://localhost:5050" : location.origin);

const s = io(SOCKET_URL, { withCredentials: true, transports: ["websocket"] });

// optional, handy for quick testing in DevTools:
(window as any).getSocket = () => s;

export function getSocket() {
  return s;
}

export type Peer = { id: string; name: string; color: string; file?: string };

export function usePresence(
  room: string,
  me: { name: string; color: string; file?: string }
) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const fileRef = useRef(me.file);

  // keep latest file ref for heartbeats
  useEffect(() => {
    fileRef.current = me.file;
  }, [me.file]);

  useEffect(() => {
    if (!room) return;

    const sock = getSocket();

    // join room with identity
    sock.emit("collab:join", { room, user: { name: me.name, color: me.color } });

    // presence updates from server
    const onUpd = (p: { room: string; peers: Peer[] }) => {
      if (p?.room === room) setPeers(Array.isArray(p.peers) ? p.peers : []);
    };
    sock.on("collab:presence:update", onUpd);

    // initial heartbeat (carry current file), then periodic
    sock.emit("collab:presence", { file: fileRef.current });
    const hb = setInterval(() => {
      sock.emit("collab:presence", { file: fileRef.current });
    }, 15_000);

    return () => {
      clearInterval(hb);
      sock.off("collab:presence:update", onUpd);
      // tell the room we left (server may prune immediately or ignore)
      sock.emit("collab:leave", { room });
      // we keep the socket alive; server handles room lifecycle on disconnect
    };
  }, [room, me.name, me.color]);

  return { peers };
}

export function broadcastComment(payload: any) {
  getSocket().emit("collab:comment:broadcast", payload);
}

export function onCommentEvent(handler: (p: any) => void) {
  const sock = getSocket();
  const wrapped = (p: any) => handler(p);
  sock.on("collab:comment:event", wrapped);
  return () => sock.off("collab:comment:event", wrapped);
}

// --- cursor helpers ---
export function emitCursor(payload: { file?: string; startLine?: number; endLine?: number }) {
  getSocket().emit("collab:cursor", payload);
}

export function onCursor(
  handler: (p: {
    peerId: string;
    file?: string;
    startLine?: number;
    endLine?: number;
    ts: number;
  }) => void
) {
  const sock = getSocket();
  const wrap = (p: any) => handler(p);
  sock.on("collab:cursor:update", wrap);
  return () => sock.off("collab:cursor:update", wrap);
}

// --- mention helpers ---
export function sendMention(payload: {
  toName: string;
  from: { name: string; color: string };
  previewPath: string;
  file: string;
  commentId: string;
}) {
  getSocket().emit("collab:mention", payload);
}

export function onMention(handler: (p: any) => void) {
  const sock = getSocket();
  const wrap = (p: any) => handler(p);
  sock.on("collab:mention", wrap);
  return () => sock.off("collab:mention", wrap);
}

// --- util: my socket id (for accurate chip filtering, etc.) ---
export function getMySocketId() {
  return getSocket().id;
}
