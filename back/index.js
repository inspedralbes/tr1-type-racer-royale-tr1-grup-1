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
const racePlayers = new Map(); // roomId -> Map(socketId -> {nickname, wmp, accuracy, speed, position})
const TRACK_LEN = 100; // "distance" in %
const TICK_MS = 100; // 10 updates per second
const COUNTDOWN_TIME = 30; // 30 segundos de countdown - duración global del timer

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
          io.to(roomName).emit("gameStart", { roomName });
          io.emit("roomList", { rooms });
          console.log(`Juego iniciado en la sala ${roomName}`);
        } catch (err) {
          console.error(`Error al asignar textos para sala ${roomName}:`, err);
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

///// ***** FUNCIONES DE SOCKET.IO ***** /////

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
    createdBy: room.createdBy, // Incluir información del creador
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
      createdBy: room.createdBy, // Incluir información del creador
    }));

    socket.emit("roomList", { rooms: roomList });
    console.log(" Lista de salas enviada a", socket.id, ":", roomList);
  });

  // Evento para solicitar la configuración del timer
  socket.on("requestTimerConfig", () => {
    socket.emit("timerConfig", { duration: COUNTDOWN_TIME });
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
      players: [],
      status: "waiting",
      createdBy: data.userName, // Trackear el creador de la sala
    };

    socket.join(data.roomName);
    addPlayerToRoom(data.roomName, data.userName, socket.id);
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

    console.log(roomName, nickname);

    // Verificar que la sala existe y está esperando
    if (!rooms[roomName] || rooms[roomName].status !== "waiting") {
      socket.emit("errorJoin");
      return;
    }

    socket.join(roomName);
    socket.nickname = nickname; // Muy importante para disconnect
    socket.currentRoom = roomName;

    // Añadir jugador usando la función existente
    addPlayerToRoom(roomName, nickname, socket.id);

    console.log(
      `Cliente ${nickname} (${socket.id}) se ha unido a la sala ${roomName}`
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

    // Enviar snapshot inicial de carrera
    io.to(roomName).emit("race:update", roomSnapshot(roomName));
  });

  // Comenzamos una partida
  socket.on("startGame", async (data) => {
    const { roomName } = data;
    if (rooms[roomName]) {
      await getTexts(roomName);
      console.log(
        "Textos asignados a los jugadores de la sala",
        rooms[roomName].players
      );
      rooms[roomName].status = "inGame";
      io.to(roomName).emit("gameStarted", { roomInfo: rooms[roomName] });
      io.emit("roomList", { rooms });
      console.log(`Juego iniciado en la sala ${roomName}`);
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

    if (roomStatus[room]) {
      // Añadir el resultado a la sala
      roomStatus[room].results.push({
        nickname,
        wpm,
        accuracy,
        timestamp: Date.now(),
      });

      // Enviar los resultados actualizados a todos en la sala
      io.to(room).emit("updateGameResults", roomStatus[room].results);
      io.to(room).emit("race:update", roomSnapshot(room));
      console.log(` Nuevos resultados en ${room}:`, roomStatus[room].results);
    }
  });

  // Eliminar sala (solo el creador puede hacerlo)
  socket.on("deleteRoom", (data) => {
    const { roomName, nickname } = data;

    // Verificar que la sala existe
    if (!rooms[roomName]) {
      socket.emit("roomDeleteError", {
        message: "La sala no existe",
      });
      return;
    }

    // Verificar que el usuario es el creador de la sala
    if (rooms[roomName].createdBy !== nickname) {
      socket.emit("roomDeleteError", {
        message: "Solo el creador puede eliminar la sala",
      });
      return;
    }

    console.log(` Eliminando sala ${roomName} por ${nickname}`);

    // Notificar a todos los usuarios en la sala antes de eliminarla
    io.to(roomName).emit("roomDeleted", {
      roomName: roomName,
      message: "La sala ha sido eliminada por el creador",
    });

    // Detener timer si existe
    if (roomTimers[roomName]) {
      clearInterval(roomTimers[roomName].interval);
      delete roomTimers[roomName];
    }

    // Limpiar datos de la sala
    delete rooms[roomName];
    delete roomStatus[roomName];

    // Actualizar lista de salas para todos los clientes
    broadcastRoomList();

    // Confirmar eliminación al creador
    socket.emit("roomDeleteSuccess", {
      roomName: roomName,
      message: "Sala eliminada exitosamente",
    });

    console.log(` Sala ${roomName} eliminada exitosamente`);
  });

  // Salir de una sala específica (sin desconectar del servidor)
  socket.on("leaveRoom", (data) => {
    const { roomName, nickname } = data;

    console.log(` ${nickname} está saliendo de la sala ${roomName}`);

    // Verificar que la sala existe
    if (!rooms[roomName]) {
      console.log(`Intento de salir de sala inexistente: ${roomName}`);
      return;
    }

    // Remover usuario de la sala (buscar por nickname ya que los players son objetos)
    const userList = rooms[roomName].players;
    const index = userList.findIndex(
      (p) =>
        (typeof p === "string" && p === nickname) ||
        (typeof p === "object" && p.nickname === nickname)
    );

    // Si el usuario está en la sala, lo removemos
    if (index !== -1) {
      userList.splice(index, 1);
      console.log(
        `${nickname} removido de la sala ${roomName}. Jugadores restantes: ${userList.length}`
      );

      // También remover de racePlayers
      const raceMap = racePlayers.get(roomName);
      if (raceMap && raceMap.has(socket.id)) {
        raceMap.delete(socket.id);
      }

      // Hacer que el socket salga de la room de Socket.IO
      socket.leave(roomName);

      // Notificar a los usuarios restantes en la sala
      io.to(roomName).emit("updateUserList", userList);
      io.to(roomName).emit("userLeft", {
        nickname: nickname,
        roomName: roomName,
        remainingPlayers: userList.length,
      });

      // Manejar timer basado en número de jugadores restantes
      handleRoomPlayerCount(roomName);

      // Si la sala queda vacía, limpiarla
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

      // Actualizar lista de salas para todos los clientes
      broadcastRoomList();
    } else {
      console.log(` Usuario ${nickname} no encontrado en la sala ${roomName}`);
    }
  });

  // Iniciar timer manualmente (solo el creador puede hacerlo)
  socket.on("startTimer", (data) => {
    const { roomName, nickname } = data;

    console.log(` ${nickname} quiere iniciar el timer en la sala ${roomName}`);

    // Verificar que la sala existe
    if (!rooms[roomName]) {
      socket.emit("startTimerError", {
        message: "La sala no existe",
      });
      return;
    }

    // Verificar que el usuario es el creador de la sala
    if (rooms[roomName].createdBy !== nickname) {
      socket.emit("startTimerError", {
        message: "Solo el creador puede iniciar el timer",
      });
      return;
    }

    // Verificar que hay al menos 2 jugadores
    if (rooms[roomName].players.length < 2) {
      socket.emit("startTimerError", {
        message: "Se necesitan al menos 2 jugadores para iniciar el timer",
      });
      return;
    }

    // Verificar que no hay un timer ya activo
    if (roomTimers[roomName]?.isActive) {
      socket.emit("startTimerError", {
        message: "El timer ya está activo",
      });
      return;
    }

    console.log(`Iniciando timer manual para sala ${roomName} por ${nickname}`);

    // Iniciar el timer
    startRoomTimer(roomName);

    // Notificar a todos en la sala que el timer ha iniciado
    io.to(roomName).emit("timerStarted", {
      roomName: roomName,
      startedBy: nickname,
      message: `Timer iniciado por ${nickname}`,
    });

    // Confirmar al creador
    socket.emit("startTimerSuccess", {
      roomName: roomName,
      message: "Timer iniciado exitosamente",
    });

    console.log(`Timer iniciado exitosamente en sala ${roomName}`);
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
    console.log(`Usuario desconectándose: ${socket.id} (${socket.nickname})`);

    // Limpiar de todas las salas donde esté el usuario
    for (const [roomName, roomObj] of Object.entries(rooms)) {
      if (!roomObj || !Array.isArray(roomObj.players)) continue;

      const userList = roomObj.players;
      const initialLength = userList.length;

      // Buscar y remover por socket.id (más confiable)
      const index = userList.findIndex(
        (p) =>
          (typeof p === "object" && p.id === socket.id) ||
          (typeof p === "string" && p === socket.nickname)
      );

      if (index !== -1) {
        const removedPlayer = userList[index];
        userList.splice(index, 1);

        console.log(
          `${socket.nickname} removido de la sala ${roomName}. Jugadores restantes: ${userList.length}`
        );

        // Limpiar de racePlayers
        const raceMap = racePlayers.get(roomName);
        if (raceMap && raceMap.has(socket.id)) {
          raceMap.delete(socket.id);
        }

        // Notificar a los usuarios restantes en la sala
        io.to(roomName).emit("updateUserList", userList);
        io.to(roomName).emit("userLeft", {
          nickname: socket.nickname,
          roomName: roomName,
          remainingPlayers: userList.length,
        });

        // Manejar timer basado en número de jugadores restantes
        handleRoomPlayerCount(roomName);
      }

      // Si la sala queda vacía, limpiarla
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

    // Enviar lista actualizada de salas después de la desconexión
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
            // elegir índice aleatorio
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
