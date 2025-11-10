import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import { con } from "./db.js";
import dotenv from "dotenv";
import cors from "cors";

// Shared speed helpers for race velocity
import { calcPlayerSpeed, integratePosition } from "./shared/speed.js";

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
const timers = {}; // Temporizadores activos
const roomStatus = {}; // Almacenará los resultados de cada sala
const roomTimers = {}; // Almacenará los timers de cada sala

// RACE STATE (server-authoritative)
const racePlayers = new Map(); // roomId -> Map(socketId -> {nickname, wpm, accuracy, speed, position})
const TRACK_LEN = 100; // “distance” in %
const TICK_MS = 100; // 10 updates per second

// --------------------------------
// FUNCIONES DE MANEJO DE SALAS
// --------------------------------

function createRoom(roomId) {
  rooms[roomId] = {
    id: roomId,
    players: [],
    status: "waiting",
    results: [],
  };
  racePlayers.set(roomId, new Map());
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
  const map = racePlayers.get(roomId);
  if (!map.has(socketId)) {
    map.set(socketId, {
      id: socketId,
      nickname,
      wpm: 0,
      accuracy: 100,
      speed: 0,
      position: 0,
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

      // Notificar que el juego debe comenzar
      io.to(roomName).emit("gameStart", { roomName });
      console.log(`Juego iniciado en sala ${roomName}!`);
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
  // El timer solo puede ser iniciado manualmente por el creador de la sala
  if (playerCount < 2) {
    // Si hay menos de 2 jugadores, detener timer
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
  if (!map) return [];
  return Array.from(map.values()).map((p) => ({
    nickname: p.nickname,
    wpm: Math.round(p.wpm || 0),
    accuracy: Math.round(p.accuracy || 0),
    speed: Number((p.speed || 0).toFixed(2)),
    position: Number((p.position || 0).toFixed(1)),
  }));
}

// Update loop
setInterval(() => {
  for (const [roomId, map] of racePlayers.entries()) {
    for (const p of map.values()) {
      p.speed = calcPlayerSpeed(p.wpm);
      p.position = integratePosition(
        p.position,
        p.speed,
        TICK_MS / 1000,
        TRACK_LEN
      );
    }
    io.to(roomId).emit("race:update", roomSnapshot(roomId));
  }
}, TICK_MS);

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
      createdBy: room.createdBy, // Incluir información del creador
    }));

    socket.emit("roomList", { rooms: roomList });
    console.log(" Lista de salas enviada a", socket.id, ":", roomList);
  });

  // 1) Cliente solicita crear sala
  // 2) Cliente confirma creación de sala
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

    // Comprobar si ya existe una sala con ese nombre
    if (rooms[data.roomName]) {
      socket.emit("roomNotCreated", {
        status: "failed",
        message: "Existent ROOM",
      });
      return;
    }

    // Aseguramos que la sala esté inicializada como objeto en rooms
    rooms[data.roomName] = {
      roomName: data.roomName,
      language: data.language,
      difficulty: data.difficulty,
      players: [data.userName], // Cambiar de users a players y añadir creador
      status: "waiting",
      createdBy: data.userName, // Trackear el creador de la sala
    };

    socket.join(data.roomName);
    socket.nickname = data.userName; // Establecer nickname para disconnect

    // Inicializamos el estado del juego de la sala si no existe
    if (!roomStatus[data.roomName]) {
      roomStatus[data.roomName] = {
        results: [],
      };
    }
    console.log(rooms[data.roomName]);

    // Emitimos al cliente que ya está en la sala (y devolvemos info)
    socket.emit("roomCreated", { room: data.roomName });

    // Enviar información de la sala al creador
    socket.emit("roomInfo", rooms[data.roomName]);

    // Actualizar lista de usuarios en la sala
    io.to(data.roomName).emit("updateUserList", rooms[data.roomName].players);

    // Enviar lista actualizada de salas a todos los clientes
    broadcastRoomList();

    // Manejar timer basado en número de jugadores
    handleRoomPlayerCount(data.roomName);
  });

  socket.on("joinRoom", (data) => {
    const roomName = data.roomName;
    const nickname = data.nickname;

    socket.join(room);
    socket.nickname = nickname; // Muy importante para disconnect

    console.log(roomName, nickname);

    // Verificar que la sala existe y está esperando
    if (!rooms[roomName] || rooms[roomName].status !== "waiting") {
      socket.emit("errorJoin");
      return;
    }

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

    console.log(
      `Cliente ${nickname} (${socket.id}) se ha unido a la sala ${room}`
    );

        // Notificamos a todos los clientes de la sala
    io.to(roomName).emit("userJoined", { id: socket.id, roomName, nickname });

    // Confirmamos específicamente al usuario que se está uniendo
    socket.emit("joinedRoom", { roomName, nickname });

    // Enviamos la lista actualizada a todos los clientes en esa sala
    io.to(roomName).emit("updateUserList", rooms[roomName].players);

    // Enviamos la info de la sala también (opcional)
    io.to(roomName).emit("roomInfo", rooms[roomName]);

    // Enviar lista actualizada de salas a todos los clientes
    broadcastRoomList();

    // Inicializamos el estado de la sala si no existe
    if (!roomStatus[roomName]) {
      roomStatus[roomName] = {
        results: [],
      };
    }

    // Manejar timer basado en número de jugadores
    handleRoomPlayerCount(roomName);

    // Si ya hay un timer activo, enviar el estado actual al nuevo jugador
    if (roomTimers[roomName]?.isActive) {
      socket.emit("timerUpdate", {
        seconds: roomTimers[roomName].seconds,
        isActive: true,
      });
    }
  });

  socket.on("typing:progress", ({ room, wpm, accuracy }) => {
    const map = racePlayers.get(room);
    if (!map) return;
    const p = map.get(socket.id);
    if (!p) return;
    p.wpm = Number(wpm) || 0;
    p.accuracy = Number(accuracy) || 0;
  });

  /// Finalización del juego
  socket.on("gameFinished", (data) => {
    const { room, nickname, wpm, accuracy } = data;
    const map = racePlayers.get(room);
    if (map) {
      const p = map.get(socket.id);
      if (p) {
        p.wpm = Number(wpm) || 0;
        p.accuracy = Number(accuracy) || 0;
        p.position = TRACK_LEN;
      }
    }
    addGameResult(room, nickname, wpm, accuracy);
    io.to(room).emit("updateGameResults", rooms[room].results);
    io.to(room).emit("race:update", roomSnapshot(room));
  });

  // Detectar rendimiento de jugador (bueno o malo)
  socket.on("userPerformance", (data) => {
    const { room, nickname, status, message } = data;

    // Verificar que la sala existe
    if (!rooms[room]) {
      console.log(`Intento de emitir performance a sala inexistente: ${room}`);
      return;
    }

    console.log(`${nickname} (${room}) -> ${status}: ${message}`);

    // Emitir a TODOS en la sala (incluye al emisor)
    io.to(room).emit("userPerformance", {
      nickname,
      status,
      message,
    });
  });

  socket.on("userKey", (data) => {
    const { room, nickname, key } = data;
    // Verificar que la sala existe
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

    // Emitir junto con la tecla el color (null si no se encontró)
    io.to(room).emit("userKey", {
      nickname,
      key,
      color,
    });
  });

  socket.on("disconnect", () => {
    for (const [room, roomObj] of Object.entries(rooms)) {
      // roomObj debe ser { info: {...}, players: [...] }
      if (!roomObj || !Array.isArray(roomObj.players)) continue;

      const userList = roomObj.players;
      const index = userList.indexOf(socket.nickname);
      if (index !== -1) {
        userList.splice(index, 1);
        io.to(room).emit("updateUserList", userList);

        // Manejar timer basado en número de jugadores restantes
        handleRoomPlayerCount(room);
      }

      // Si la sala queda vacía, la limpiamos
      if (userList.length === 0) {
        delete rooms[room];
        delete roomStatus[room];
        if (roomTimers[room]) {
          clearInterval(roomTimers[room].interval);
          delete roomTimers[room];
        }
      }
    }

    // Enviar lista actualizada de salas después de la desconexión
    broadcastRoomList();

    console.log(`Usuario desconectado: ${socket.id}`);
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
        if (err) {
          console.log({ error: "Error al obtener los datos" });
          reject(err);
          return;
        }
        console.log("Textos disponibles:", results);
        for (let index = 0; index < rooms[roomName].players.length; index++) {
          // Guardar exactamente 5 ids aleatorios (o menos si no hay suficientes)
          rooms[roomName].players[index].textsIds = [];
          const count = Math.min(5, results.length);
          const numbers = results.slice();
          for (let i = 0; i < count; i++) {
            rooms[roomName].players[index].textsIds.push(numbers[i].ID);
          }
        }
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
