import { io } from "socket.io-client";

// Use env when present, otherwise fall back to local dev
const BACKEND =
  (import.meta.env.VITE_URL_BACK &&
    import.meta.env.VITE_URL_BACK.replace(/\/$/, "")) ||
  "http://localhost:3000";

// One shared connection for the whole app
export const socket = io(BACKEND, {
  autoConnect: true,
  transports: ["websocket"], // prefer WS (avoids long-polling noise)
  withCredentials: false,
  reconnection: true,
});

// Avoid double-joining the same room with same nick
let joined = { roomName: null, nick: null };

export function joinRoomOnce(roomName, nickname) {
  if (joined.roomName === roomName && joined.nick === nickname) return;

  // backend expects roomName, nickname
  socket.emit("joinRoom", { roomName, nickname });

  joined = { roomName, nick: nickname };
}