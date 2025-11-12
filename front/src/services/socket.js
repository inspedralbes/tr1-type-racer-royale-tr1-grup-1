import { io } from "socket.io-client";

// Use env when present, otherwise fall back to local dev
const BACKEND =
  (import.meta.env.VITE_URL_BACK && import.meta.env.VITE_URL_BACK.replace(/\/$/, "")) ||
  "http://localhost:3000";

// One shared connection for the whole app
export const socket = io(BACKEND, {
  autoConnect: true,
  transports: ["websocket"], // prefer WS (avoids long-polling noise)
  withCredentials: false,
  reconnection: true,
});

// Optional: avoid double-joining the same room with same nick
let joined = { room: null, nick: null };
export function joinRoomOnce(room, nickname) {
  if (joined.room === room && joined.nick === nickname) return;
  socket.emit("joinRoom", { room, nickname });
  joined = { room, nick: nickname };
}