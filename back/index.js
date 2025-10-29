import express from "express";
import http from "http";
import { Server } from "socket.io";
import { con } from "./db.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Ruta Express de prova
app.get("/", (req, res) => {
  res.json({ message: "Hola mundo desde GET /" });
});

// 🔹 Socket.IO — quan un client es connecta
io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);
  // 1) Cliente solicita crear sala
  socket.on("requestRoomCreation", (data) => {
    // data = { roomName, maybe other metadata }
    console.log(`Solicitud crear sala: ${data.roomName} por ${socket.id}`);

    // enviamos al mismo cliente la petición de confirmación
    // (también podrías enviarla a un host o UI específica)
    socket.emit("confirmRoomCreation", { roomName: data.roomName });
  });

  // 2) Cliente confirma creación de sala
  socket.on("createRoom", (data) =>{
    const room = data.room;
    socket.join(room);
  //Enviamos al cliente la sala creada
    socket.emit("roomCreated", { room: room });
    console.log(`creada ${room}}`)
  });

  // El client demana les preguntes
 const sql = "SELECT * FROM QUESTIONS";
    con.query( sql , (err, results) => {

      //Enviamos a los clientes que estan dentro de la sala las preguntas
      io.to(room).emit("questions", results);
      console.log(`Preguntes enviades a la sala ${room}`);
  });

  socket.on("joinRoom", (data) => {
    const room = data.room;

    socket.join(room); // el client s'uneix a la sala
    console.log(`👥 Client ${socket.id} s'ha unit a la sala ${room}`);

    // Notifiquem a tots els de la sala (inclòs el nou)
    io.to(room).emit("userJoined", { id: socket.id, room });
  }); 
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`✅ Servidor Socket.io corriendo en http://localhost:${PORT}`);
});
