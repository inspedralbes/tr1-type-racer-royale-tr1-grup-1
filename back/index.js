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
const rooms = {};

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  // 1) Cliente solicita crear sala
  socket.on("requestRoomCreation", (data) => {
    let roomName;

    if (!activeRoom) {
      // Si no hay sala activa, creamos una nueva
      activeRoom = data.roomName;
      roomName = activeRoom;
      console.log(`Sala creada: ${roomName} por ${socket.id}`);
    } else {
      // Si ya hay sala activa, el cliente se une a la existente
      roomName = activeRoom;
      console.log(`Sala existente: ${roomName}, el cliente se unirá`);
    }

    console.log(`Solicitud crear sala: ${data.roomName} por ${socket.id}`);
    socket.emit("confirmRoomCreation", { roomName: data.roomName });
  });

  // 2) Cliente confirma creación de sala
  socket.on("createRoom", (data) => {
    const room = data.room || activeRoom; // Si viene vacía, usamos la sala activa
    socket.join(room);

    // Emitimos al cliente que ya está en la sala
    socket.emit("roomCreated", { room });
    console.log(`Cliente ${socket.id} unido a la sala ${room}`);
  });

  // Cliente se une a una sala existente
  socket.on("joinRoom", (data) => {
    const room = data.room;
    const nickname = data.nickname;

    socket.join(room);
    socket.nickname = nickname; // 🔹 Muy importante para disconnect

    // Si la sala no existe, la creamos
    if (!rooms[room]) {
      rooms[room] = [];
    }

    // Añadimos el nickname si no está ya
    if (!rooms[room].includes(nickname)) {
      rooms[room].push(nickname);
    }

    console.log(
      `👥 Cliente ${nickname} (${socket.id}) se ha unido a la sala ${room}`
    );

    // Notificamos a todos los clientes de la sala
    io.to(room).emit("userJoined", { id: socket.id, room, nickname });

    // Enviamos la lista actualizada a todos los clientes en esa sala
    io.to(room).emit("updateUserList", rooms[room]);
  });

  socket.on("disconnect", () => {
    for (const [room, userList] of Object.entries(rooms)) {
      const index = userList.indexOf(socket.nickname);
      if (index !== -1) {
        userList.splice(index, 1);
        io.to(room).emit("updateUserList", userList);
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
  console.log(`✅ Servidor Socket.io corriendo en http://localhost:${PORT}`);
});
