<template>
  <section style="padding: 1.5rem">
    <h2 style="font-size: 1.5rem; font-weight: 600">Lobby</h2>
    <p style="margin-top: 0.5rem">
      Welcome, <strong>{{ user.nickname }}!</strong>
    </p>

    <!-- Información de la sala -->
    <div v-if="roomInfo" style="
        margin: 1rem 0;
        padding: 1rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
      ">
      <h3 style="
          font-weight: 600;
          font-size: 1rem;
          margin: 0 0 0.5rem 0;
          color: #1e293b;
        ">
        Sala: {{ roomInfo.roomName }}
      </h3>
      <div style="
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          font-size: 0.9rem;
          color: #64748b;
        ">
        <span>Idioma:
          {{
            roomInfo.language === "es"
              ? "Español"
              : roomInfo.language === "ca"
                ? "Catalán"
                : "Inglés"
          }}</span>
        <span>Dificultad:
          {{
            typeof roomInfo.difficulty === "number"
              ? roomInfo.difficulty === 1
                ? "Fácil"
                : roomInfo.difficulty === 2
                  ? "Intermedio"
                  : "Difícil"
              : roomInfo.difficulty === "facil"
                ? "Fácil"
                : roomInfo.difficulty === "intermig"
                  ? "Intermedio"
                  : "Difícil"
          }}</span>
        <span>Jugadores: {{ players.length }}</span>
      </div>
    </div>
  </section>
  <section>
    <div style="
        max-width: 400px;
        margin: 1rem auto;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        padding: 0.75rem;
      ">
      <h3 style="font-weight: 600; font-size: 1rem">
        Jugadores conectados ({{ players.length }})
      </h3>

      <!-- Mostrar lista de jugadores y timer cuando hay más de 1 jugador -->
      <div v-if="players.length > 1">
        <ul style="
            border: 1px solid #d1d5db;
            border-radius: 0.5rem;
            padding: 0.5rem;
            margin-top: 0.5rem;
            list-style: none;
          ">
          <li v-for="player in players" :key="player.id" style="padding: 0.25rem 0">
            <span>{{ player.name }}</span>
            <span v-if="player.name === user.nickname" style="color: #2563eb; font-size: 0.85rem; margin-left: 4px">
              (You)
            </span>
          </li>
        </ul>

        <!-- Timer sincronizado que se muestra cuando está activo -->
        <div v-if="isTimerActive" :style="{
          width: '75px',
          height: '75px',
          borderRadius: '50%',
          border: `6px solid ${seconds <= 5 ? '#dc2626' : '#2563eb'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: 'black',
          margin: '1.5rem auto',
          transition: 'all 0.3s ease',
        }">
          {{ seconds }}
        </div>

        <!-- Mensaje cuando no hay timer activo pero hay jugadores -->
        <div v-else style="margin-top: 0.5rem; text-align: center">
          <p style="margin-bottom: 0.5rem; color: #2563eb; font-size: 0.9rem">
            Timer listo para iniciar
          </p>

          <!-- Botón para iniciar timer (solo para el creador) -->
          <button v-if="isRoomCreator" @click="startTimer" :disabled="startingTimer" style="
              background: #2563eb;
              color: white;
              border: none;
              padding: 0.5rem 1rem;
              border-radius: 0.5rem;
              cursor: pointer;
              font-weight: 600;
            " :style="{
              opacity: startingTimer ? '0.5' : '1',
              cursor: startingTimer ? 'not-allowed' : 'pointer',
            }">
            {{ startingTimer ? "Iniciando..." : "Iniciar Timer" }}
          </button>

          <p v-else style="color: #6b7280; font-size: 0.85rem; margin-top: 0.5rem">
            Solo el creador puede iniciar el timer
          </p>
        </div>
      </div>
      <!-- Mensaje de espera cuando no hay suficientes jugadores -->
      <div v-else style="margin-top: 0.5rem; text-align: center">
        <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 0.5rem">
          Esperando que se unan más jugadores...
        </p>
        <p style="color: #9ca3af; font-size: 0.8rem">
          Se necesitan al menos 2 jugadores para comenzar
        </p>
      </div>
    </div>

    <div style="
        margin-top: 1rem;
        text-align: center;
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        flex-wrap: wrap;
      ">
      <!-- Botón para eliminar sala (solo para el creador) -->
      <button v-if="isRoomCreator" @click="deleteRoom" :disabled="deleting" style="
          border: 1px solid #dc2626;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          background: white;
          color: #dc2626;
          cursor: pointer;
        " :style="{
          opacity: deleting ? '0.5' : '1',
          cursor: deleting ? 'not-allowed' : 'pointer',
        }">
        {{ deleting ? "Eliminando..." : " Eliminar Sala" }}
      </button>

      <button @click="logout" style="
          border: 1px solid #d1d5db;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          background: white;
          color: #6b7280;
          cursor: pointer;
        ">
        Salir de la sala
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { socket } from "@/services/socket.js";

const router = useRouter();
const user = useUserStore();
const players = ref([]);
const roomInfo = ref(null); // Información de la sala actual
const deleting = ref(false); // Estado de eliminación
const startingTimer = ref(false); // Estado de inicio de timer

const seconds = ref(0); // duración del temporizador - controlado por el servidor
const isTimerActive = ref(false); // estado del timer

// Computed para verificar si el usuario actual es el creador de la sala
const isRoomCreator = computed(() => {
  return roomInfo.value && roomInfo.value.createdBy === user.nickname;
});

// Cuando el componente se monta
onMounted(() => {
  // Escuchar actualizaciones del timer sincronizado desde el servidor
  socket.on("timerUpdate", (data) => {
    console.log("Timer actualizado desde servidor:", data);
    seconds.value = data.seconds;
    isTimerActive.value = data.isActive;
  });

  // Escuchar cuando el juego debe empezar
  socket.on("gameStart", (data) => {
    console.log(" Juego iniciado!", data);
    router.push("/play");
  });

  // Nos unimos a la sala activa (si ya existe en backend)
  socket.on("updateUserList", (list) => {
    console.log("Lista actualizada desde el servidor:", list);
    players.value = list.map((p, i) => ({
      id: p.id || i + 1,
      name: p.nickname ?? p.name ?? String(p)
    }));
  });

  // Escuchamos cuando un nuevo usuario entra
  socket.on("userJoined", (data) => {
    console.log(` ${data.nickname} se ha unido a ${data.roomName}`);
  });

  // Escuchamos cuando un usuario sale
  socket.on("userLeft", (data) => {
    console.log(` ${data.nickname} ha salido de ${data.roomName}`);
  });

  // Escuchar información de la sala
  socket.on("roomInfo", (data) => {
    console.log("Información de la sala:", data);
    roomInfo.value = data;
  });

  // Escuchar cuando la sala es eliminada
  socket.on("roomDeleted", (data) => {
    console.log("Sala eliminada:", data);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: `${data.message}`,
    });
    router.push("/");
  });

  // Escuchar confirmación de eliminación exitosa
  socket.on("roomDeleteSuccess", (data) => {
    console.log("Sala eliminada exitosamente:", data);
    deleting.value = false;
    Swal.fire({
      icon: "error",
      title: "Error",
      text: `${data.message}`,
    });
    router.push("/");
  });

  // Escuchar errores de eliminación
  socket.on("roomDeleteError", (data) => {
    console.log("Error al eliminar sala:", data);
    deleting.value = false;
    Swal.fire({
      icon: "error",
      title: "Error",
      text: `${data.message}`,
    });
    router.push('/');
  });

  // Escuchar cuando el timer es iniciado
  socket.on("timerStarted", (data) => {
    console.log("Timer iniciado:", data);
    startingTimer.value = false;
  });

  // Escuchar confirmación de inicio de timer exitoso
  socket.on("startTimerSuccess", (data) => {
    console.log("Timer iniciado exitosamente:", data);
    startingTimer.value = false;
  });

  // Escuchar errores de inicio de timer
  socket.on("startTimerError", (data) => {
    console.log("Error al iniciar timer:", data);
    startingTimer.value = false;
    Swal.fire({
      icon: "error",
      title: "Error",
      text: `${data.message}`,
    });
    router.push('/');
  });
});

onUnmounted(() => {
  // Limpiar los listeners cuando el componente se desmonta
  cleanupSocketListeners();
});

function deleteRoom() {
  if (!roomInfo.value) return;

  const confirmDelete = confirm(
    `¿Estás seguro de que quieres eliminar la sala "${roomInfo.value.roomName}"? Esta acción no se puede deshacer.`
  );

  if (confirmDelete) {
    deleting.value = true;
    socket.emit("deleteRoom", {
      roomName: roomInfo.value.roomName,
      nickname: user.nickname,
    });
  }
}

function startTimer() {
  if (!roomInfo.value) return;

  console.log("Iniciando timer...");
  startingTimer.value = true;

  socket.emit("startTimer", {
    roomName: roomInfo.value.roomName,
    nickname: user.nickname,
  });
}

function logout() {
  console.log("Saliendo de la sala...");

  // Limpiar listeners antes de salir
  cleanupSocketListeners();

  // Si hay información de la sala, notificar al servidor que salimos
  if (roomInfo.value) {
    console.log(`Notificando salida de la sala: ${roomInfo.value.roomName}`);
    // Emitir evento de desconexión explícita de la sala
    socket.emit("leaveRoom", {
      roomName: roomInfo.value.roomName,
      nickname: user.nickname,
    });
  }

  // Limpiar estado local
  players.value = [];
  roomInfo.value = null;
  seconds.value = 0;
  isTimerActive.value = false;

  // Redirigir al home (mantenemos el nickname para que no tenga que volver a introducirlo)
  router.push({ name: "home" });
}

// Función para limpiar los listeners de socket.io
function cleanupSocketListeners() {
  socket.off("timerUpdate");
  socket.off("gameStart");
  socket.off("updateUserList");
  socket.off("userJoined");
  socket.off("userLeft");
  socket.off("roomInfo");
  socket.off("roomDeleted");
  socket.off("roomDeleteSuccess");
  socket.off("roomDeleteError");
  socket.off("timerStarted");
  socket.off("startTimerSuccess");
  socket.off("startTimerError");
}
</script>
