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

  // keep latest file ref for heartbeats
  useEffect(() => {
    fileRef.current = me.file;
  }, [me.file]);

  useEffect(() => {
    if (!room) return;

    const s = getSocket();

    // join room with identity
    s.emit("collab:join", { room, user: { name: me.name, color: me.color } });

    // presence updates from server
    const onUpd = (p: { room: string; peers: Peer[] }) => {
      if (p?.room === room) setPeers(Array.isArray(p.peers) ? p.peers : []);
    };
    s.on("collab:presence:update", onUpd);

    // initial heartbeat (carry current file), then periodic
    s.emit("collab:presence", { file: fileRef.current });
    const hb = setInterval(() => {
      s.emit("collab:presence", { file: fileRef.current });
    }, 15_000);

    return () => {
      clearInterval(hb);
      s.off("collab:presence:update", onUpd);
      // we keep the socket alive; server handles room lifecycle on disconnect
    };
  }, [room, me.name, me.color]);

  return { peers };
}

export function broadcastComment(payload: any) {
  getSocket().emit("collab:comment:broadcast", payload);
}

export function onCommentEvent(handler: (p: any) => void) {
  const s = getSocket();
  const wrapped = (p: any) => handler(p);
  s.on("collab:comment:event", wrapped);
  return () => s.off("collab:comment:event", wrapped);
}
