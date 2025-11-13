import express from "express";
import http from "node:http";
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
const HOST = "0.0.0.0";

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

const rooms = {}; // { roomId: { id, players: [], status, results: [] } }
const timers = {}; // (legacy, may be unused by dev lobby)
const roomStatus = {}; // resultados por sala
const roomTimers = {}; // timers de cada sala

// RACE STATE (server-authoritative)
const racePlayers = new Map(); // roomId -> Map(socketId -> {nickname, wpm, accuracy, speed, position})
const raceMonster = new Map();
const raceMeta = new Map(); // roomId -> { monsterStartAt }
const TICK_MS = 100; // 10 updates per second

// --------------------------------
// FUNCIONES DE MANEJO DE SALAS
// --------------------------------

function createRoom(roomId) {
  rooms[roomId] = {
    id: roomId,
    roomName: roomId,         // or whatever dev branch uses
    players: [],
    status: "waiting",
    results: [],
  };

  // race players
  if (!racePlayers.has(roomId)) {
    racePlayers.set(roomId, new Map());
  }

  // 🧟 monster + meta
  if (!raceMonster.has(roomId)) {
    raceMonster.set(roomId, {
      position: -MONSTER_START_GAP,
      speed: MONSTER_BASE,
    });
  }
  if (!raceMeta.has(roomId)) {
    raceMeta.set(roomId, { monsterStartAt: null });
  }

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
      color: getRandomColor(),
      isAlive: true,
    });
  }

  // add also to race state
  let map = racePlayers.get(roomId);
  if (!map) {
    map = new Map();
    racePlayers.set(roomId, map);
  }

  if (!map.has(socketId)) {
    map.set(socketId, {
      id: socketId,
      nickname,
      wpm: 0,
      accuracy: 100,
      speed: BASE_SPEED,
      position: 0,
      lastTypingTs: Date.now(),
      alive: true,
      finished: false,
    });
  }

  console.log(`${nickname} se ha unido a la sala ${roomId}`);
}

// Función: generar color aleatorio
function getRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

// Función: eliminar jugador al desconectarse
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
  rooms[roomId].results = rooms[roomId].results || [];
  rooms[roomId].results.push({
    nickname,
    wpm: Number(wpm),
    accuracy: Number(accuracy),
    timestamp: Date.now(),
  });
  console.log(
    `Resultado añadido en ${roomId}: ${nickname} (${wpm}WPM, ${accuracy}%)`
  );
}

// -----------------------------------
// TIMER Y SINCRONIZACIÓN DE JUEGO
// -----------------------------------

function startRoomTimer(roomName) {
  if (roomTimers[roomName]) {
    clearInterval(roomTimers[roomName].interval);
  }

  const COUNTDOWN_TIME = 30; // 30 segundos de countdown

  roomTimers[roomName] = {
    seconds: COUNTDOWN_TIME,
    interval: null,
    isActive: true,
  };

  console.log(
    `Iniciando timer para sala ${roomName} - ${COUNTDOWN_TIME} segundos`
  );

  // Enviar tiempo inicial
  io.to(roomName).emit("timerUpdate", {
    seconds: COUNTDOWN_TIME,
    isActive: true,
  });

  roomTimers[roomName].interval = setInterval(() => {
    roomTimers[roomName].seconds--;

    // Enviar actualización de tiempo a todos los jugadores de la sala
    io.to(roomName).emit("timerUpdate", {
      seconds: roomTimers[roomName].seconds,
      isActive: true,
    });

    console.log(
      `Timer sala ${roomName}: ${roomTimers[roomName].seconds} segundos`
    );

    if (roomTimers[roomName].seconds <= 0) {
      clearInterval(roomTimers[roomName].interval);
      roomTimers[roomName].isActive = false;

      (async () => {
        try {
          await getTexts(roomName);
          console.log(
            "Textos asignados a los jugadores de la sala",
            rooms[roomName].players
          );
          rooms[roomName].status = "inGame";

          let meta = raceMeta.get(roomName);
          if (!meta) {
            meta = { monsterStartAt: null };
            raceMeta.set(roomName, meta);
          }
          meta.monsterStartAt = Date.now() + MONSTER_START_DELAY * 1000;

          io.to(roomName).emit("gameStart", { roomName });
          io.emit("roomList", { rooms });
          console.log(`Juego iniciado en la sala ${roomName}`);
        } catch (err) {
          console.error(
            `Error al asignar textos para sala ${roomName}:`,
            err
          );
        }
      })();
    }
  }, 1000);
}

// Función para parar el timer de una sala
function stopRoomTimer(roomName) {
  if (roomTimers[roomName]) {
    clearInterval(roomTimers[roomName].interval);
    roomTimers[roomName].isActive = false;
    console.log(`Timer detenido para sala ${roomName}`);
    io.to(roomName).emit("timerUpdate", {
      seconds: 0,
      isActive: false,
    });
  }
}

// Función para manejar el timer cuando cambia el número de jugadores
function handleRoomPlayerCount(roomName) {
  if (!rooms[roomName]) return;

  const playerCount = rooms[roomName].players.length;

  console.log(
    ` Revisando timer para sala ${roomName}: ${playerCount} jugadores`
  );

  // Solo detener el timer si hay menos de 2 jugadores
  if (playerCount < 2) {
    if (roomTimers[roomName]?.isActive) {
      console.log(
        `Deteniendo timer para sala ${roomName} (${playerCount} jugadores)`
      );
      stopRoomTimer(roomName);
    }
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
    if (!rooms[room]) continue;

    // 1) advance players + check finish
    for (const p of map.values()) {
      if (p.alive === false) continue;

      p.speed = decaySpeed(p.speed, dt);
      p.position = integratePosition(p.position, p.speed, dt, TRACK_LEN);

      // emit single "finished" event per player
      if (p.position >= TRACK_LEN && !p.finished) {
        p.finished = true;

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
    const m = raceMonster.get(room);
    let meta = raceMeta.get(room);
    const now = Date.now();

    if (!meta) {
      meta = { monsterStartAt: null };
      raceMeta.set(room, meta);
    }

    let canMove = true;
    let canCatch = true;

    if (!meta.monsterStartAt || now < meta.monsterStartAt) {
      canMove = false;
      canCatch = false;
    }
    if (
      meta.monsterStartAt &&
      now < meta.monsterStartAt + MONSTER_SAFE_TIME * 1000
    ) {
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
            mPos: m.position,
            pPos: p.position,
            hitBox: HIT_BOX,
            trackLen: TRACK_LEN,
          });

          io.to(room).emit("updateGameResults", rooms[room].results);
        }
      }
    }

    // 4) room end?
    const playersArr = Array.from(map.values());
    const allResolved = playersArr.every(
      (pl) => pl.finished === true || pl.alive === false
    );

    if (allResolved) {
      const winner =
        rooms[room].results?.find((r) => r.state === "finished")?.nickname ??
        null;
      io.to(room).emit("race:over", { winner });
      rooms[room].status = "finished";
      continue;
    }

    // 5) broadcast snapshot
    const snap = roomSnapshot(room);
    io.to(room).emit("race:update", snap);
  }
}, TICK_MS);

///// ***** FUNCIONES DE SOCKET.IO ***** /////

// Enviar lista de salas a todos los clientes conectados
function broadcastRoomList() {
  const roomList = Object.values(rooms).map((room) => ({
    name: room.roomName,
    players: room.players,
    playerCount: room.players.length,
    status: room.status,
    language: room.language,
    difficulty: room.difficulty,
    createdBy: room.createdBy,
  }));

  io.emit("roomList", { rooms: roomList });
  console.log(" Lista de salas enviada:", roomList);
}

// -----------------------------------
// SOCKET.IO - EVENTOS EN TIEMPO REAL
// -----------------------------------

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  // Evento para solicitar la lista de salas disponibles
  socket.on("requestRoomList", () => {
    const roomList = Object.values(rooms).map((room) => ({
      name: room.roomName,
      players: room.players,
      playerCount: room.players.length,
      status: room.status,
      language: room.language,
      difficulty: room.difficultyValue,
      createdBy: room.createdBy,
    }));

    socket.emit("roomList", { rooms: roomList });
    console.log(" Lista de salas enviada a", socket.id, ":", roomList);
  });

  // Crear sala
  socket.on("createRoom", (data) => {
    if (
      !data.roomName ||
      !data.language ||
      !data.difficulty ||
      !data.userName
    ) {
      socket.emit("roomNotCreated", {
        status: "failed",
        message: "ERROR",
      });
      return;
    }

    if (rooms[data.roomName]) {
      socket.emit("roomNotCreated", {
        status: "failed",
        message: "Existent ROOM",
      });
      return;
    }

    // ✅ Use the helper – this creates racePlayers, raceMonster, raceMeta, results…
    createRoom(data.roomName);

    // Fill in lobby-specific fields
    const room = rooms[data.roomName];
    room.roomName  = data.roomName;
    room.language  = data.language;
    room.difficulty = data.difficulty;
    room.createdBy = data.userName;

    socket.join(data.roomName);
    addPlayerToRoom(data.roomName, data.userName, socket.id);
    socket.nickname = data.userName;

    if (!roomStatus[data.roomName]) {
      roomStatus[data.roomName] = { results: [] };
    }
    console.log(room);

    socket.emit("roomCreated", { room: data.roomName });
    socket.emit("roomInfo", room);

    io.to(data.roomName).emit("updateUserList", room.players);

    broadcastRoomList();
    handleRoomPlayerCount(data.roomName);
  });

  socket.on("joinRoom", (data) => {
    const roomName = data.roomName;
    const nickname = data.nickname;

    console.log(roomName, nickname);

    if (!rooms[roomName] || rooms[roomName].status !== "waiting") {
      socket.emit("errorJoin");
      return;
    }

    socket.join(roomName);
    socket.nickname = nickname;
    socket.currentRoom = roomName;

    addPlayerToRoom(roomName, nickname, socket.id);

    console.log(
      `Cliente ${nickname} (${socket.id}) se ha unido a la sala ${roomName}`
    );

    io.to(roomName).emit("userJoined", { id: socket.id, roomName, nickname });

    socket.emit("joinedRoom", { roomName, nickname });

    io.to(roomName).emit("updateUserList", rooms[roomName].players);
    io.to(roomName).emit("roomInfo", rooms[roomName]);

    broadcastRoomList();

    if (!roomStatus[roomName]) {
      roomStatus[roomName] = {
        results: [],
      };
    }

    handleRoomPlayerCount(roomName);

    if (roomTimers[roomName]?.isActive) {
      socket.emit("timerUpdate", {
        seconds: roomTimers[roomName].seconds,
        isActive: true,
      });
    }

    io.to(roomName).emit("race:update", roomSnapshot(roomName));
  });

  // Comenzar partida sin countdown (ruta antigua)
  socket.on("startGame", async (data) => {
    const { roomName } = data;
    if (rooms[roomName]) {
      await getTexts(roomName);
      console.log(
        "Textos asignados a los jugadores de la sala",
        rooms[roomName].players
      );
      rooms[roomName].status = "inGame";

      // también iniciar monstruo en esta ruta
      let meta = raceMeta.get(roomName);
      if (!meta) {
        meta = { monsterStartAt: null };
        raceMeta.set(roomName, meta);
      }
      meta.monsterStartAt = Date.now() + MONSTER_START_DELAY * 1000;

      io.to(roomName).emit("gameStarted", { roomInfo: rooms[roomName] });
      io.emit("roomList", { rooms });
      console.log(`Juego iniciado en la sala ${roomName}`);
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

  /// Finalización del juego (alcanzó TRACK_LEN explícitamente)
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
        p.finished = true;
      }
    }

    if (roomStatus[room]) {
      roomStatus[room].results.push({
        nickname,
        wpm,
        accuracy,
        timestamp: Date.now(),
      });

      io.to(room).emit("updateGameResults", roomStatus[room].results);
      io.to(room).emit("race:update", roomSnapshot(room));
      console.log(` Nuevos resultados en ${room}:`, roomStatus[room].results);
    }
  });

  // Eliminar sala (solo el creador puede hacerlo)
  socket.on("deleteRoom", (data) => {
    const { roomName, nickname } = data;

    if (!rooms[roomName]) {
      socket.emit("roomDeleteError", {
        message: "La sala no existe",
      });
      return;
    }

    if (rooms[roomName].createdBy !== nickname) {
      socket.emit("roomDeleteError", {
        message: "Solo el creador puede eliminar la sala",
      });
      return;
    }

    console.log(` Eliminando sala ${roomName} por ${nickname}`);

    io.to(roomName).emit("roomDeleted", {
      roomName: roomName,
      message: "La sala ha sido eliminada por el creador",
    });

    if (roomTimers[roomName]) {
      clearInterval(roomTimers[roomName].interval);
      delete roomTimers[roomName];
    }

    delete rooms[roomName];
    delete roomStatus[roomName];

    broadcastRoomList();

    socket.emit("roomDeleteSuccess", {
      roomName: roomName,
      message: "Sala eliminada exitosamente",
    });

    console.log(` Sala ${roomName} eliminada exitosamente`);
  });

  // Salir de una sala específica
  socket.on("leaveRoom", (data) => {
    const { roomName, nickname } = data;

    console.log(` ${nickname} está saliendo de la sala ${roomName}`);

    if (!rooms[roomName]) {
      console.log(`Intento de salir de sala inexistente: ${roomName}`);
      return;
    }

    const userList = rooms[roomName].players;
    const index = userList.findIndex(
      (p) =>
        (typeof p === "string" && p === nickname) ||
        (typeof p === "object" && p.nickname === nickname)
    );

    if (index !== -1) {
      userList.splice(index, 1);
      console.log(
        `${nickname} removido de la sala ${roomName}. Jugadores restantes: ${userList.length}`
      );

      const raceMap = racePlayers.get(roomName);
      if (raceMap && raceMap.has(socket.id)) {
        raceMap.delete(socket.id);
      }

      socket.leave(roomName);

      io.to(roomName).emit("updateUserList", userList);
      io.to(roomName).emit("userLeft", {
        nickname: nickname,
        roomName: roomName,
        remainingPlayers: userList.length,
      });

      handleRoomPlayerCount(roomName);

      if (userList.length === 0) {
        console.log(`Limpiando sala vacía: ${roomName}`);
        delete rooms[roomName];
        delete roomStatus[roomName];
        racePlayers.delete(roomName);
        if (roomTimers[roomName]) {
          clearInterval(roomTimers[roomName].interval);
          delete roomTimers[roomName];
        }
      }

      broadcastRoomList();
    } else {
      console.log(` Usuario ${nickname} no encontrado en la sala ${roomName}`);
    }
  });

  // Iniciar timer manualmente (solo el creador puede hacerlo)
  socket.on("startTimer", (data) => {
    const { roomName, nickname } = data;

    console.log(` ${nickname} quiere iniciar el timer en la sala ${roomName}`);

    if (!rooms[roomName]) {
      socket.emit("startTimerError", {
        message: "La sala no existe",
      });
      return;
    }

    if (rooms[roomName].createdBy !== nickname) {
      socket.emit("startTimerError", {
        message: "Solo el creador puede iniciar el timer",
      });
      return;
    }

    if (rooms[roomName].players.length < 2) {
      socket.emit("startTimerError", {
        message: "Se necesitan al menos 2 jugadores para iniciar el timer",
      });
      return;
    }

    if (roomTimers[roomName]?.isActive) {
      socket.emit("startTimerError", {
        message: "El timer ya está activo",
      });
      return;
    }

    console.log(`Iniciando timer manual para sala ${roomName} por ${nickname}`);

    startRoomTimer(roomName);

    io.to(roomName).emit("timerStarted", {
      roomName: roomName,
      startedBy: nickname,
      message: `Timer iniciado por ${nickname}`,
    });

    socket.emit("startTimerSuccess", {
      roomName: roomName,
      message: "Timer iniciado exitosamente",
    });

    console.log(`Timer iniciado exitosamente en sala ${roomName}`);
  });

  // Detectar rendimiento de jugador (bueno o malo)
  socket.on("userPerformance", (data) => {
    const { room, nickname, status, message } = data;

    if (!rooms[room]) {
      console.log(`Intento de emitir performance a sala inexistente: ${room}`);
      return;
    }

    console.log(`${nickname} (${room}) -> ${status}: ${message}`);

    io.to(room).emit("userPerformance", {
      nickname,
      status,
      message,
    });
  });

  socket.on("userKey", (data) => {
    const { room, nickname, key } = data;
    if (!rooms[room]) {
      console.log(`Intento de emitir userKey a sala inexistente: ${room}`);
      return;
    }
    const player = rooms[room].players.find((p) => p.nickname === nickname);
    const color = player ? player.color : null;
    if (!player) {
      console.log(`No se encontró jugador ${nickname} en la sala ${room}`);
    } else {
      console.log(`Color de ${nickname} en ${room}: ${color}`);
    }

    io.to(room).emit("userKey", {
      nickname,
      key,
      color,
    });
  });

  socket.on("disconnect", () => {
    console.log(`Usuario desconectándose: ${socket.id} (${socket.nickname})`);

    for (const [roomName, roomObj] of Object.entries(rooms)) {
      if (!roomObj || !Array.isArray(roomObj.players)) continue;

      const userList = roomObj.players;

      const index = userList.findIndex(
        (p) =>
          (typeof p === "object" && p.id === socket.id) ||
          (typeof p === "string" && p === socket.nickname)
      );

      if (index !== -1) {
        userList.splice(index, 1);

        console.log(
          `${socket.nickname} removido de la sala ${roomName}. Jugadores restantes: ${userList.length}`
        );

        const raceMap = racePlayers.get(roomName);
        if (raceMap && raceMap.has(socket.id)) {
          raceMap.delete(socket.id);
        }

        io.to(roomName).emit("updateUserList", userList);
        io.to(roomName).emit("userLeft", {
          nickname: socket.nickname,
          roomName: roomName,
          remainingPlayers: userList.length,
        });

        handleRoomPlayerCount(roomName);
      }

      if (userList.length === 0) {
        console.log(`Limpiando sala vacía: ${roomName}`);
        delete rooms[roomName];
        delete roomStatus[roomName];
        racePlayers.delete(roomName);
        if (roomTimers[roomName]) {
          clearInterval(roomTimers[roomName].interval);
          delete roomTimers[roomName];
        }
      }
    }

    broadcastRoomList();

    console.log(`Usuario desconectado completamente: ${socket.id}`);
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

function getTexts(roomName) {
  return new Promise((resolve, reject) => {
    con.query(
      "SELECT ID FROM TEXTS WHERE LANGUAGE_CODE = ? AND DIFFICULTY = ?",
      [rooms[roomName].language, rooms[roomName].difficulty],
      (err, results) => {
        if (err) return reject(err);
        console.log("Textos disponibles:", results);
        for (let player of rooms[roomName].players) {
          player.textsIds = [];
          for (let i = 0; i < 5 && i < results.length; i++) {
            const randomIndex = Math.floor(Math.random() * results.length);
            player.textsIds.push(results[randomIndex].ID);
          }
        }

        console.log(
          "Textos asignados a los jugadores de la sala",
          rooms[roomName].players
        );
        resolve();
      }
    );
  });
}

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
server.listen(PORT, HOST, () => {
  console.log(
    `Servidor Socket.IO corriendo en http://localhost:${HOST}:${PORT}`
  );
  console.log("Rutas API disponibles:");
  console.log("  GET /api/rooms - Listar salas activas");
  console.log("  GET /api/rooms/:roomId - Info de sala");
  console.log("  GET /texts - Todos los textos");
  console.log("  GET /texts/:id - Texto por ID");
  console.log("  GET /words/:language - Palabra aleatoria");
});