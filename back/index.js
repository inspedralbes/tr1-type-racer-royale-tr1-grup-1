import express from "express";
import http from "http";
import { Server } from "socket.io";
import { con } from "./db.js";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

// ------------------------------------
// CONFIGURACION BASICA DEL SERVIDOR
// ------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Permitir peticiones desde cualquier origen

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Ruta de prueba (Express)
app.get("/", (req, res) => {
  res.json({ message: "Hola mundo desde GET /" });
});

// -------------------------------
// ESTRUCTURA DE DATOS DEL JUEGO
// -------------------------------

// Guardará todas las salas y su estado
const rooms = {}; // { roomId: { id, players: [], status, results: [] } }
const timers = {}; // Para manejar timers por sala

// Función: crear sala
function createRoom(roomId) {
  rooms[roomId] = {
    id: roomId,
    players: [],
    status: "waiting", // waiting | playing | finished
    results: [],
  };
  console.log(`Sala creada: ${roomId}`);
}

// Función: añadir jugador a una sala
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

    // Eliminar room si está vacía
    if (room.players.length === 0) {
      delete rooms[roomId];
      console.log(`Sala ${roomId} eliminada (sin jugadores)`);
    }
  }
  console.log(`Jugador desconectado eliminado: ${socketId}`);
}

// Función: guardar resultados
// Función: guardar resultados
function addGameResult(roomId, nickname, wpm, accuracy) {
  if (!rooms[roomId]) {
    console.log(`Error: Sala ${roomId} no existe`);
    return false;
  }

  rooms[roomId].results.push({
    nickname,
    wpm: Number(wpm),
    accuracy: Number(accuracy),
    timestamp: Date.now(),
  });

  console.log(
    `Resultado añadido en ${roomId}: ${nickname} (${wpm} WPM, ${accuracy}%)`
  );
  return true;
}

// Función: iniciar timer sincronizado para una sala
function startRoomTimer(roomId) {
  if (timers[roomId]) {
    clearInterval(timers[roomId]);
  }

  let seconds = 10;

  // Emitir estado inicial del timer
  io.to(roomId).emit("timerUpdate", { seconds, isActive: true });

  timers[roomId] = setInterval(() => {
    seconds--;

    if (seconds > 0) {
      io.to(roomId).emit("timerUpdate", { seconds, isActive: true });
    } else {
      // Timer terminado
      io.to(roomId).emit("timerUpdate", { seconds: 0, isActive: false });
      clearInterval(timers[roomId]);
      delete timers[roomId];

      // Cambiar estado de la sala a "playing"
      if (rooms[roomId]) {
        rooms[roomId].status = "playing";
      }

      console.log(`Timer terminado para sala ${roomId}. Iniciando juego.`);
    }
  }, 1000);

  console.log(`Timer iniciado para sala ${roomId}`);
}

// Función: detener timer de una sala
function stopRoomTimer(roomId) {
  if (timers[roomId]) {
    clearInterval(timers[roomId]);
    delete timers[roomId];
    io.to(roomId).emit("timerUpdate", { seconds: 10, isActive: false });
    console.log(`Timer detenido para sala ${roomId}`);
  }
}

// -----------------------------------
// SOCKET.IO - EVENTOS EN TIEMPO REAL
// -----------------------------------

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  // Cliente pide crear sala
  socket.on("requestRoomCreation", (data) => {
    const roomName = data.roomName;

    if (!rooms[roomName]) {
      createRoom(roomName);
    }

    socket.emit("confirmRoomCreation", { roomName });
    console.log(`Solicitud crear sala: ${roomName} por ${socket.id}`);
  });

  // Cliente crea o se une a una sala
  socket.on("createRoom", (data) => {
    const room = data.room || data.roomName;
    socket.join(room);
    if (!rooms[room]) createRoom(room);

    socket.emit("roomCreated", { room });
    console.log(`Cliente ${socket.id} unido a la sala ${room}`);
  });

  // Cliente se une a sala existente
  socket.on("joinRoom", (data) => {
    try {
      const { room, nickname } = data;

      if (!room || !nickname) {
        socket.emit("error", { message: "Room y nickname son requeridos" });
        return;
      }

      socket.join(room);
      socket.nickname = nickname;
      socket.currentRoom = room; // Para tracking

      addPlayerToRoom(room, nickname, socket.id);

      io.to(room).emit("updateUserList", rooms[room].players);

      // Iniciar timer si hay más de 1 jugador y no está ya iniciado
      if (rooms[room].players.length > 1 && !timers[room]) {
        startRoomTimer(room);
      }
    } catch (error) {
      console.error("Error en joinRoom:", error);
      socket.emit("error", { message: "Error al unirse a la sala" });
    }
  });

  // Iniciar timer manualmente (por si el frontend lo solicita)
  socket.on("startTimer", (data) => {
    const { room } = data;
    if (rooms[room] && rooms[room].players.length > 1 && !timers[room]) {
      startRoomTimer(room);
    }
  });

  // Resultados de la partida
  socket.on("gameFinished", (data) => {
    const { room, nickname, wpm, accuracy } = data;
    const success = addGameResult(room, nickname, wpm, accuracy);

    if (success) {
      io.to(room).emit("updateGameResults", rooms[room].results);
    }
  });

  // Detectar rendimiento de jugador (bueno o malo)
  socket.on("userPerformance", (data) => {
    const { room, nickname, status, message } = data;

    // Verificar que la sala existe
    if (!rooms[room]) {
      console.log(`Intento de emitir performance a sala inexistente: ${room}`);
      return;
    }

    console.log(rooms);
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
    console.log(rooms);
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

  // Desconexión
  socket.on("disconnect", () => {
    removePlayer(socket.id);

    // Actualizar la lista de jugadores en todas las salas
    for (const [roomId, roomData] of Object.entries(rooms)) {
      io.to(roomId).emit("updateUserList", roomData.players);

      // Detener timer si quedan menos de 2 jugadores
      if (roomData.players.length < 2 && timers[roomId]) {
        stopRoomTimer(roomId);
      }
    }

    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

// -------------------------
// RUTAS EXPRESS (API REST)
// -------------------------

// Obtener info de una sala específica
app.get("/api/rooms/:roomId", (req, res) => {
  const room = rooms[req.params.roomId];
  if (!room) {
    return res.status(404).json({ error: "Sala no encontrada" });
  }
  res.json(room);
});

// Listar todas las salas activas
app.get("/api/rooms", (req, res) => {
  res.json(Object.values(rooms));
});

// Obtener todos los textos
app.get("/texts", (req, res) => {
  con.query("SELECT * FROM TEXTS", (err, results) => {
    if (err)
      return res.status(500).json({ error: "Error al obtener los datos" });
    res.json(results);
  });
});

// Obtener texto por ID
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

// Obtener palabra aleatoria por idioma
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
server.listen(PORT, () => {
  console.log(`Servidor Socket.IO corriendo en http://localhost:${PORT}`);
  console.log(`Rutas API disponibles:`);
  console.log(`  GET /api/rooms - Listar todas las salas activas`);
  console.log(`  GET /api/rooms/:roomId - Info de una sala específica`);
  console.log(`  GET /texts - Todos los textos de la BD`);
  console.log(`  GET /texts/:id - Texto específico por ID`);
  console.log(`  GET /words/:language - Palabra aleatoria por idioma`);
});
