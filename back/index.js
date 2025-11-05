import express from "express";
import http from "http";
import { Server } from "socket.io";
import { con } from "./db.js";
import dotenv from "dotenv";
import cors from "cors";

// NEW: shared speed helpers
import { calcPlayerSpeed, integratePosition } from "./shared/speed.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Ruta Express de prova
app.get("/", (req, res) => {
  res.json({ message: "Hola mundo desde GET /" });
});

let activeRoom = null;
const rooms = {};
const roomStatus = {};  // resultados por sala

// NEW: server-authoritative race state
// room -> Map(socketId -> { id, nickname, wpm, accuracy, speed, position })
const racePlayers = new Map(); 
const TRACK_LEN = 100;   // treat as percentage (0..100)
const TICK_MS = 100;     // 10 Hz

// helper: return snapshot for a room
function roomSnapshot(room) {
  const map = racePlayers.get(room);
  if (!map) return [];
  return Array.from(map.values()).map(p => ({
    nickname: p.nickname,
    wpm: Math.round(p.wpm || 0),
    accuracy: Math.round(p.accuracy || 0),
    speed: Number((p.speed || 0).toFixed(2)),
    position: Number((p.position || 0).toFixed(1)),
  }));
}

// NEW: tick loop — integrates positions and broadcasts
setInterval(() => {
  const now = Date.now();
  // iterate all rooms that have race state
  for (const [room, map] of racePlayers.entries()) {
    // integrate movement for all players in the room
    for (const p of map.values()) {
      p.speed = calcPlayerSpeed(p.wpm);
      // dt from last tick is effectively TICK_MS/1000 here; that’s good enough
      p.position = integratePosition(p.position, p.speed, TICK_MS / 1000, TRACK_LEN);
    }
    io.to(room).emit("race:update", roomSnapshot(room));
  }
}, TICK_MS);

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  // 1) Cliente solicita crear sala
  socket.on("requestRoomCreation", (data) => {
    let roomName;

    if (!activeRoom) {
      activeRoom = data.roomName;
      roomName = activeRoom;
      console.log(`Sala creada: ${roomName} por ${socket.id}`);
    } else {
      roomName = activeRoom;
      console.log(`Sala existente: ${roomName}, el cliente se unirá`);
    }

    console.log(`Solicitud crear sala: ${data.roomName} por ${socket.id}`);
    socket.emit("confirmRoomCreation", { roomName: data.roomName });
  });

  // 2) Cliente confirma creación de sala
  socket.on("createRoom", (data) => {
    const room = data.room || activeRoom;
    socket.join(room);

    if (!roomStatus[room]) roomStatus[room] = { results: [] };

    // NEW: init race state map for the room
    if (!racePlayers.has(room)) racePlayers.set(room, new Map());

    socket.emit("roomCreated", { room });
    console.log(`Cliente ${socket.id} unido a la sala ${room}`);
  });

  // Cliente se une a una sala existente
  socket.on("joinRoom", (data) => {
    const room = data.room;
    const nickname = data.nickname;

    socket.join(room);
    socket.nickname = nickname; // para disconnect

    if (!rooms[room]) rooms[room] = [];
    if (!rooms[room].includes(nickname)) rooms[room].push(nickname);

    console.log(`👥 Cliente ${nickname} (${socket.id}) se ha unido a la sala ${room}`);

    io.to(room).emit("userJoined", { id: socket.id, room, nickname });
    io.to(room).emit("updateUserList", rooms[room]);

    if (!roomStatus[room]) roomStatus[room] = { results: [] };

    // NEW: also add to the race state for this room
    if (!racePlayers.has(room)) racePlayers.set(room, new Map());
    const map = racePlayers.get(room);
    map.set(socket.id, {
      id: socket.id,
      nickname,
      wpm: 0,
      accuracy: 100,
      speed: 0,
      position: 0,
    });

    // send an immediate snapshot so new player sees current positions
    io.to(room).emit("race:update", roomSnapshot(room));
  });

  // NEW: live typing progress (from PlayView)
  // { room, nickname, wpm, accuracy, percent, ts }
  socket.on("typing:progress", ({ room, wpm, accuracy }) => {
    const map = racePlayers.get(room);
    if (!map) return;
    const p = map.get(socket.id);
    if (!p) return;

    p.wpm = Number(wpm) || 0;
    p.accuracy = Number(accuracy) || 0;
    // position is integrated in the tick loop
  });

  // Recibir resultados del juego
  socket.on("gameFinished", (data) => {
    const { room, nickname, wpm, accuracy } = data;

    // snap to finish line in race state
    const map = racePlayers.get(room);
    if (map) {
      const p = map.get(socket.id);
      if (p) {
        p.wpm = Number(wpm) || 0;
        p.accuracy = Number(accuracy) || 0;
        p.position = TRACK_LEN;
      }
    }

    if (roomStatus[room]) {
      roomStatus[room].results.push({
        nickname,
        wpm,
        accuracy,
        timestamp: Date.now()
      });
      io.to(room).emit("updateGameResults", roomStatus[room].results);
      // also push a fresh race snapshot
      io.to(room).emit("race:update", roomSnapshot(room));
      console.log(` Nuevos resultados en ${room}:`, roomStatus[room].results);
    }
  });

  socket.on("disconnect", () => {
    for (const [room, userList] of Object.entries(rooms)) {
      const index = userList.indexOf(socket.nickname);
      if (index !== -1) {
        userList.splice(index, 1);
        io.to(room).emit("updateUserList", userList);
      }
      // NEW: remove from race state
      const map = racePlayers.get(room);
      if (map && map.has(socket.id)) {
        map.delete(socket.id);
        io.to(room).emit("race:update", roomSnapshot(room));
      }
    }
    console.log(` Usuario desconectado: ${socket.id}`);
  });
});

// Textos
app.get("/texts", (req, res) => {
  con.query("SELECT * FROM TEXTS", (err, results) => {
    if (err)
      return res.status(500).json({ error: "Error al obtener los datos" });
    res.json(results);
  });
});

app.get("/texts/:id", (req, res) => {
  con.query(
    "SELECT * FROM TEXTS WHERE ID = ?",
    [req.params.id],
    (err, results) => {
      if (err)
        return res.status(500).json({ error: "Error al obtener los datos" });
      res.json(results[0]);
    }
  );
});

// Palabras
app.get("/words/:language", (req, res) => {
  const { language } = req.params;
  con.query(
    "SELECT * FROM WORDS WHERE LANGUAGE_CODE = ?",
    [language],
    (err, results) => {
      if (err)
        return res.status(500).json({ error: "Error al obtener los datos" });
      if (!results || results.length === 0) {
        return res
          .status(404)
          .json({ error: "No se encontraron palabras para este idioma" });
      }
      const randomIndex = Math.floor(Math.random() * results.length);
      res.json(results[randomIndex]);
    }
  );
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor Socket.io corriendo en http://localhost:${PORT}`);
});