import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import { con } from "./db.js";
import dotenv from "dotenv";
import cors from "cors";

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
// ahora cada rooms[roomName] será un objeto { info: {roomName, language, difficulty, userName}, players: [] }
const rooms = {};
const roomStatus = {}; // Almacenará los resultados de cada sala
const roomTimers = {}; // Almacenará los timers de cada sala

//// **** FUNCIONES DEL TIMER ***** /////
//  Iniciar el timer sincronizado de una sala
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

  // Cliente se une a una sala existente
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

    // Añadimos el nickname si no está ya
    if (!rooms[roomName].players.includes(nickname)) {
      rooms[roomName].players.push(nickname);
    }

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

  // Recibir resultados del juego
  socket.on("gameFinished", (data) => {
    const { room, nickname, wpm, accuracy } = data;

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

    // Remover usuario de la sala
    const userList = rooms[roomName].players;
    const index = userList.indexOf(nickname);

    // Si el usuario está en la sala, lo removemos
    if (index !== -1) {
      userList.splice(index, 1);
      console.log(
        `${nickname} removido de la sala ${roomName}. Jugadores restantes: ${userList.length}`
      );

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
