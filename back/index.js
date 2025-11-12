import express from "express";
import http from "http";
import { Server } from "socket.io";
import { con } from "./db.js";
import dotenv from "dotenv";
import cors from "cors";

// Shared speed helpers for race velocity
import {
  TRACK_LEN,
  BASE_SPEED,
  applyCorrectChar,
  decaySpeed,
  integratePosition,
  MONSTER_BASE,
  MONSTER_ACCEL,
  MONSTER_MAX,
  MONSTER_START_GAP,
  MONSTER_START_DELAY,
  MONSTER_SAFE_TIME,
  HIT_BOX, 
} from "./shared/speed.js";

dotenv.config();

// ------------------------------------
// CONFIGURACIÓN BÁSICA DEL SERVIDOR
// ------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Ruta de prueba
app.get("/", (req, res) => {
  res.json({ message: "Hola mundo desde GET /" });
});

// -------------------------------
// ESTRUCTURA DE DATOS DEL JUEGO
// -------------------------------

const rooms = {};   // { roomId: { id, players: [], status, results: [] } }
const timers = {};  // Temporizadores activos

// 🔹 RACE STATE (server-authoritative)
const racePlayers = new Map(); // roomId -> Map(socketId -> {nickname, wpm, accuracy, speed, position})
const raceMonster = new Map();
const raceMeta = new Map(); // roomId -> { position, speed }
const TICK_MS = 100;   // 10 updates per second

// --------------------------------
// FUNCIONES DE MANEJO DE SALAS
// --------------------------------

function createRoom(roomId) {
  rooms[roomId] = {
    id: roomId,
    players: [],
    status: "waiting",
    results: []
  };
  racePlayers.set(roomId, new Map());
  raceMonster.set(roomId, { position: -MONSTER_START_GAP, speed: MONSTER_BASE });
  raceMeta.set(roomId, { monsterStartAt: null });
  console.log(`Sala creada: ${roomId}`);
}

function addPlayerToRoom(roomId, nickname, socketId) {
  if (!rooms[roomId]) createRoom(roomId);

  const exists = rooms[roomId].players.find((p) => p.nickname === nickname);
  if (!exists) {
    rooms[roomId].players.push({
      id: socketId,
      nickname,
      wpm: 0,
      accuracy: 0,
      isAlive: true
    });
  }

  // add also to race state
  const map = racePlayers.get(roomId);
  if (!map.has(socketId)) {
    map.set(socketId, {
      id: socketId,
      nickname,
      wpm: 0,
      accuracy: 100,
      speed: BASE_SPEED,
      position: 0,
      lastTypingTs: Date.now(),
      alive: true
    });
  }

  console.log(`${nickname} se ha unido a la sala ${roomId}`);
}

function removePlayer(socketId) {
  for (const [roomId, room] of Object.entries(rooms)) {
    room.players = room.players.filter((p) => p.id !== socketId);
    const map = racePlayers.get(roomId);
    if (map && map.has(socketId)) map.delete(socketId);

    if (room.players.length === 0) {
      delete rooms[roomId];
      racePlayers.delete(roomId);
      raceMonster.delete(roomId);
      raceMeta.delete(roomId);
      console.log(`Sala ${roomId} eliminada (vacía)`);
    }
  }
  console.log(`Jugador desconectado eliminado: ${socketId}`);
}

function addGameResult(roomId, nickname, wpm, accuracy) {
  if (!rooms[roomId]) return;
  rooms[roomId].results.push({
    nickname,
    wpm: Number(wpm),
    accuracy: Number(accuracy),
    timestamp: Date.now()
  });
  console.log(
    `Resultado añadido en ${roomId}: ${nickname} (${wpm}WPM, ${accuracy}%)`
  );
}

// -----------------------------------
// TIMER Y SINCRONIZACIÓN DE JUEGO
// -----------------------------------

function startRoomTimer(roomId) {
  if (timers[roomId]) clearInterval(timers[roomId]);

  let seconds = 10;
  io.to(roomId).emit("timerUpdate", { seconds, isActive: true });

  timers[roomId] = setInterval(() => {
    seconds--;

    if (seconds > 0) {
      io.to(roomId).emit("timerUpdate", { seconds, isActive: true });
    } else {
      io.to(roomId).emit("timerUpdate", { seconds: 0, isActive: false });
      clearInterval(timers[roomId]);
      delete timers[roomId];

      if (rooms[roomId]) rooms[roomId].status = "playing";
      let meta = raceMeta.get(roomId);
      if (!meta) {
        meta = { monsterStartAt: null };
        raceMeta.set(roomId, meta);
      }
      meta.monsterStartAt = Date.now() + MONSTER_START_DELAY * 1000;
      console.log(`Timer terminado para sala ${roomId}. Iniciando juego.`);
    }
  }, 1000);
}

function stopRoomTimer(roomId) {
  if (timers[roomId]) {
    clearInterval(timers[roomId]);
    delete timers[roomId];
    io.to(roomId).emit("timerUpdate", { seconds: 10, isActive: false });
    console.log(`Timer detenido para sala ${roomId}`);
  }
}

// -------------------------------------
// RACE LOGIC (VELOCIDAD Y POSICIÓN)
// -------------------------------------

function roomSnapshot(roomId) {
  const map = racePlayers.get(roomId);
  const mon = raceMonster.get(roomId);
  return {
    trackLen: TRACK_LEN,
    players: map
      ? Array.from(map.values()).map(p => ({
          nickname: p.nickname,
          wpm: Math.round(p.wpm || 0),
          accuracy: Math.round(p.accuracy || 0),
          speed: Number((p.speed || 0).toFixed(2)),
          position: Number((p.position || 0).toFixed(1)),
          alive: p.alive !== false,
        }))
      : [],
    monster: mon
      ? {
          position: Number((mon.position || 0).toFixed(1)),
          speed: Number((mon.speed || 0).toFixed(2)),
        }
      : null,
  };
}

// Update loop
setInterval(() => {
  const dt = TICK_MS / 1000;

  for (const [room, map] of racePlayers.entries()) {
    // 1) advance players + check finish
    for (const p of map.values()) {
      if (p.alive === false) continue;

      p.speed    = decaySpeed(p.speed, dt);
      p.position = integratePosition(p.position, p.speed, dt, TRACK_LEN);

      // emit single "finished" event per player
      if (p.position >= TRACK_LEN && !p.finished) {
        p.finished = true;

        // store + emit once
        rooms[room].results = rooms[room].results || [];
        rooms[room].results.push({
          nickname: p.nickname,
          wpm: Math.round(p.wpm || 0),
          accuracy: Math.round(p.accuracy || 0),
          state: "finished",
          timestamp: Date.now(),
        });

        io.to(room).emit("player:finished", {
          nickname: p.nickname,
          wpm: Math.round(p.wpm || 0),
          accuracy: Math.round(p.accuracy || 0),
        });

        io.to(room).emit("updateGameResults", rooms[room].results);
      }
    }

    // 2) monster
    const m    = raceMonster.get(room);
    let   meta = raceMeta.get(room);
    const now  = Date.now();

    if (!meta) {
      meta = { monsterStartAt: null };
      raceMeta.set(room, meta);
    }

    let canMove  = true;
    let canCatch = true;

    if (!meta.monsterStartAt || now < meta.monsterStartAt) {
      canMove = false;
      canCatch = false;
    }
    if (meta.monsterStartAt && now < meta.monsterStartAt + MONSTER_SAFE_TIME * 1000) {
      canCatch = false;
    }

    if (m && canMove) {
      m.speed += MONSTER_ACCEL * dt;
      if (m.speed > MONSTER_MAX) m.speed = MONSTER_MAX;
      m.position += m.speed * dt;
      if (m.position > TRACK_LEN) m.position = TRACK_LEN;
    }

    // 3) collisions
    if (m && canCatch) {
      for (const p of map.values()) {
        if (p.alive === false) continue;
        if (m.position + HIT_BOX >= p.position) {
          p.alive = false;
          p.speed = 0;

          // store in room results (so late joiners / refresh get it)
          rooms[room].results = rooms[room].results || [];
          rooms[room].results.push({
            nickname: p.nickname,
            wpm: Math.round(p.wpm || 0),
            accuracy: Math.round(p.accuracy || 0),
            state: "dead",
            timestamp: Date.now(),
          });

          io.to(room).emit("player:caught", {
            nickname: p.nickname,
            wpm: Math.round(p.wpm || 0),
            accuracy: Math.round(p.accuracy || 0),
            mPos: m.position, pPos: p.position,
            hitBox: HIT_BOX, trackLen: TRACK_LEN,
          });

          io.to(room).emit("updateGameResults", rooms[room].results);
        }
      }
    }

    // 4) room end?
    const alive = Array.from(map.values()).filter(p => p.alive !== false);
    const someoneFinished = alive.some(p => p.position >= TRACK_LEN);
    const allDead = alive.length === 0;
    const playersArr = Array.from(map.values());
    const allResolved = playersArr.every(pl => pl.finished === true || pl.alive === false);

    if (allResolved) {
      // Optional: pick a winner (first finished); if none, null
      const winner = rooms[room].results?.find(r => r.state === "finished")?.nickname ?? null;
      io.to(room).emit("race:over", { winner });
      rooms[room].status = "finished";
      continue;
    }
    /*if (allDead || someoneFinished) {
      io.to(room).emit("race:over", {
        winner: someoneFinished
          ? alive.find(p => p.position >= TRACK_LEN)?.nickname ?? null
          : null,
      });
      rooms[room].status = "finished";
      continue; // skip broadcast this tick
    }*/

    // 5) broadcast snapshot
    io.to(room).emit("race:update", roomSnapshot(room));
  }
}, TICK_MS);

// -----------------------------------
// SOCKET.IO - EVENTOS EN TIEMPO REAL
// -----------------------------------

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("requestRoomCreation", (data) => {
    const roomName = data.roomName;
    if (!rooms[roomName]) createRoom(roomName);
    socket.emit("confirmRoomCreation", { roomName });
  });

  socket.on("createRoom", (data) => {
    const room = data.room || data.roomName;
    socket.join(room);
    if (!rooms[room]) createRoom(room);
    socket.emit("roomCreated", { room });
  });

  socket.on("joinRoom", (data) => {
    try {
      const { room, nickname } = data;
      if (!room || !nickname) return;

      socket.join(room);
      socket.nickname = nickname;
      socket.currentRoom = room;

      addPlayerToRoom(room, nickname, socket.id);
      io.to(room).emit("updateUserList", rooms[room].players);

      if (rooms[room].players.length > 1 && !timers[room]) {
        startRoomTimer(room);
      }

      // enviar snapshot inicial de carrera
      io.to(room).emit("race:update", roomSnapshot(room));
    } catch (err) {
      console.error("Error en joinRoom:", err);
    }
  });

  // Recibir progreso de tipeo (PlayView)
  socket.on("typing:progress", ({ room, correctChar, wpm, accuracy }) => {
    const map = racePlayers.get(room);
    if (!map) return;
    const p = map.get(socket.id);
    if (!p) return;


    p.wpm = Number(wpm) || 0;
    p.accuracy = Number(accuracy) || 0;

    if (correctChar === true) {
      p.speed = applyCorrectChar(p.speed);
    }
    p.lastTypingTs = Date.now();
  });

  // Finalización del juego
  socket.on("gameFinished", (data) => {
    const { room, nickname, wpm, accuracy } = data;
    const map = racePlayers.get(room);
    if (map) {
      const p = map.get(socket.id);
      if (p) {
        p.wpm = Number(wpm) || 0;
        p.accuracy = Number(accuracy) || 0;
        p.position = TRACK_LEN;
        p.speed = 0;
      }
    }
    addGameResult(room, nickname, wpm, accuracy);
    io.to(room).emit("updateGameResults", rooms[room].results);
    io.to(room).emit("race:update", roomSnapshot(room));
  });

  socket.on("disconnect", () => {
    const roomId = socket.currentRoom;
    removePlayer(socket.id);

    if (roomId && rooms[roomId]) {
      io.to(roomId).emit("updateUserList", rooms[roomId].players);
      if (rooms[roomId].players.length < 2 && timers[roomId]) {
        stopRoomTimer(roomId);
      }
      io.to(roomId).emit("race:update", roomSnapshot(roomId));
    }
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

// -------------------------
// RUTAS EXPRESS (API REST)
// -------------------------

app.get("/api/rooms/:roomId", (req, res) => {
  const room = rooms[req.params.roomId];
  if (!room) return res.status(404).json({ error: "Sala no encontrada" });
  res.json(room);
});

app.get("/api/rooms", (req, res) => {
  res.json(Object.values(rooms));
});

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

// -----------------
// INICIAR SERVIDOR
// -----------------
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Socket.IO corriendo en http://localhost:${PORT}`);
  console.log("Rutas API disponibles:");
  console.log("  GET /api/rooms - Listar salas activas");
  console.log("  GET /api/rooms/:roomId - Info de sala");
  console.log("  GET /texts - Todos los textos");
  console.log("  GET /texts/:id - Texto por ID");
  console.log("  GET /words/:language - Palabra aleatoria");
});