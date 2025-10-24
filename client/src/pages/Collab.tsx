// client/src/lib/collab.ts
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

let _sock: Socket | null = null;
function getSocket() {
  if (_sock) return _sock;
  _sock = io("/", { transports: ["websocket"] });
  return _sock;
}

export type Peer = { id: string; name: string; color: string; file?: string };

export function usePresence(
  room: string,
  me: { name: string; color: string; file?: string }
) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const fileRef = useRef(me.file);

  useEffect(() => {
    fileRef.current = me.file;
  }, [me.file]);

  useEffect(() => {
    if (!room) return;
    const s = getSocket();

    // join with identity
    s.emit("collab:join", { room, user: { name: me.name, color: me.color } });

    const onUpd = (p: { room: string; peers: Peer[] }) => {
      if (p?.room === room) setPeers(p.peers || []);
    };
    s.on("collab:presence:update", onUpd);

    // heartbeat presence (with current file)
    const hb = setInterval(() => {
      s.emit("collab:presence", { file: fileRef.current });
    }, 10_000);

    // cleanup
    return () => {
      clearInterval(hb);
      s.off("collab:presence:update", onUpd);
      // proactively notify server we're leaving this room
      s.emit("collab:leave", { room }); // ADD THIS
      // keep socket alive for other hooks/pages
    };
  }, [room, me.name, me.color]);

  return { peers };
}

/* ----- Comments bus ----- */

export function broadcastComment(payload: any) {
  getSocket().emit("collab:comment:broadcast", payload);
}

export function onCommentEvent(handler: (p: any) => void) {
  const s = getSocket();
  const h = (p: any) => handler(p);
  s.on("collab:comment:event", h);
  return () => s.off("collab:comment:event", h);
}

/* ----- Cursor/selection bus ----- */

export function emitCursor(payload: {
  file?: string;
  startLine?: number;
  endLine?: number;
}) {
  getSocket().emit("collab:cursor", payload);
}

export function onCursor(handler: (p: any) => void) {
  const s = getSocket();
  const h = (p: any) => handler(p);
  s.on("collab:cursor:update", h);
  return () => s.off("collab:cursor:update", h);
}

/* ----- Mentions bus ----- */

export function onMention(handler: (p: any) => void) {
  const s = getSocket();
  const h = (p: any) => handler(p);
  s.on("collab:mention", h);
  return () => s.off("collab:mention", h);
}
