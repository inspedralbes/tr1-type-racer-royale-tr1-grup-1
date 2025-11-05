import express from "express";
import http from "http";
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
// ahora cada rooms[roomName] será un objeto { info: {roomName, language, difficulty, userName}, users: [] }
const rooms = {};
const roomStatus = {}; // Almacenará los resultados de cada sala

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  // 1) Cliente solicita crear sala
  // 2) Cliente confirma creación de sala

  socket.emit("roomList", { rooms });

  socket.on("getRoomList", () => {
    socket.emit("roomList", { rooms });
  });

  socket.on("createRoom", (data) => {
    // Si no viene room, usamos activeRoom; si tampoco hay, creamos una con id de socket
    const room = data;

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
      results: [],
    };

    socket.join(rooms[data.roomName].roomName);

    // Inicializamos el estado del juego de la sala si no existe
    if (!roomStatus[room]) {
      roomStatus[room] = {
        results: [],
      };
    }

    // Emitimos al cliente que ya está en la sala (y devolvemos info)
    socket.emit("roomCreated", { rooms });
    socket.emit("roomList", { rooms });
  });

  // Cliente se une a una sala existente
  socket.on("joinRoom", (data) => {
    console.log("data", data);
    const roomName = data.roomName;
    const nickname = data.nickname;
    const master = data.master;

    console.log(roomName, nickname);

    if (rooms[roomName] == undefined || !rooms[roomName].status == "waiting") {
      socket.emit("errorJoin");
    }

    socket.join(roomName);
    socket.nickname = nickname; // 🔹 Muy importante para disconnect

    console.log("DD", rooms);
    console.log("EE", rooms[data.roomName]);

    socket.join(roomName);
    socket.nickname = nickname;

    // Crear objeto jugador (no dentro de player:{}, directamente {})
    const newPlayer = {
      id: socket.id,
      master,
      textsIds: [],
      nickname,
      wpm: 0,
      accuracy: 0,
      isAlive: true,
    };

    // Simulación de includes() para objetos
    let exists = false;
    for (let i = 0; i < rooms[roomName].players.length; i++) {
      if (rooms[roomName].players[i].nickname === nickname) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      rooms[roomName].players.push(newPlayer);
    }

    console.log(
      `👥 Cliente ${nickname} (${socket.id}) se ha unido a la sala ${roomName}`
    );

    // Notificamos a todos los clientes de la sala
    io.to(roomName).emit("userJoined", { id: socket.id, roomName, nickname });

    // Enviamos la lista actualizada a todos los clientes en esa sala
    io.to(roomName).emit("updateUserList", rooms[roomName].players);

    // Enviamos la info de la sala también (opcional)
    io.to(roomName).emit("roomInfo", rooms[roomName]);

    socket.emit("roomList", { rooms });
  });

  // Comenzamos una partida
  socket.on("startGame", (data) => {
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

  socket.on("disconnect", () => {
    for (const [room, roomObj] of Object.entries(rooms)) {
      // roomObj debe ser { info: {...}, users: [...] }
      if (!roomObj || !Array.isArray(roomObj.users)) continue;

      const userList = roomObj.users;
      const index = userList.indexOf(socket.nickname);
      if (index !== -1) {
        userList.splice(index, 1);
        io.to(room).emit("updateUserList", userList);
      }

      // Si la sala queda vacía, la limpiamos
      if (userList.length === 0) {
        delete rooms[room];
        delete roomStatus[room];
      }
    }
    console.log(` Usuario desconectado: ${socket.id}`);
  });
});

function getTexts(roomName) {
  con.query(
    "SELECT ID FROM TEXTS WHERE LANGUAGE_CODE = ? AND DIFFICULTY = ?",
    [rooms[roomName].language, rooms[roomName].difficulty],
    (err, results) => {
      if (err) console.log({ error: "Error al obtener los datos" });
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
    }
  );
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
