import { io, Socket } from "socket.io-client";
let s: Socket | null = null;
export function getSocket(){
  if(!s) s = io("/", { transports:["websocket"] });
  return s;
}
