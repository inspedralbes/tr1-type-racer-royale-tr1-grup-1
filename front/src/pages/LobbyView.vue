<template>
  <section
    class="relative min-h-screen flex flex-col items-center justify-start px-6 py-8 font-dogica text-gray-200 bg-gradient-to-b from-[#0B0C10] to-[#1F2833] overflow-hidden">
    <!-- Fondo e iluminación -->
    <img src="/src/assets/opt2_img1.png" alt="Zombie sky background"
      class="absolute inset-0 w-full h-full object-cover opacity-80" />
    <div class="absolute inset-0 bg-black/40"></div>
    <div class="absolute inset-0 z-10 pointer-events-none transition-all duration-700 ease-out"
      :class="{ 'fog-animated': isTimerActive }" :style="fogStyle"></div>
    <!-- Contenido principal -->
    <main class="relative z-20 w-full max-w-xl space-y-6 animate-fadeIn">
      <!-- Header -->
      <h2 class="text-3xl text-lime-400 font-bold drop-shadow-[0_0_15px_#66FCF1] text-center tracking-widest">
        Panteó d'espera
      </h2>
      <p class="text-center text-gray-300 animate-fadeItem delay-[100ms]">
        Benvingut, <span class="text-lime-400">{{ user.nickname }}</span>
      </p>

      <!-- Información de la sala -->
      <div v-if="roomInfo"
        class="bg-black/40 border border-lime-400 rounded-lg p-4 text-sm text-gray-300 space-y-2 animate-fadeItem delay-[200ms]">
        <h3 class="text-lime-400 font-semibold text-lg">
          Panteó: {{ roomInfo.roomName }}
        </h3>
        <div class="flex flex-wrap gap-4 text-xs md:text-sm text-gray-400">
          <span>Idioma:
            {{
              roomInfo.language === "es"
                ? "Espanyol"
                : roomInfo.language === "ca"
                  ? "Català"
                  : "Anglès"
            }}
          </span>
          <span>
            Dificultat:
            {{
              typeof roomInfo.difficulty === "number"
                ? roomInfo.difficulty === 1
                  ? "Fàcil"
                  : roomInfo.difficulty === 2
                    ? "Intermedi"
                    : "Difícil"
                : roomInfo.difficulty === "facil"
                  ? "Fàcil"
                  : roomInfo.difficulty === "intermig"
                    ? "Intermedi"
                    : "Difícil"
            }}
          </span>
          <span>Jugadors: {{ players.length }}</span>
        </div>
      </div>

      <!-- Jugadores conectados -->
      <div class="bg-black/40 border border-lime-400 rounded-lg p-4 shadow-lg space-y-4 animate-fadeItem delay-[300ms]">
        <h3 class="text-lime-400 text-lg font-semibold flex items-center gap-2">
          Jugadors connectats
          <span class="text-gray-400 text-sm">({{ players.length }})</span>
        </h3>

        <!-- Si hay jugadores -->
        <div v-if="players.length > 1" class="space-y-4">
          <ul class="bg-gray-900/40 border border-gray-700 rounded-md p-2 divide-y divide-gray-700">
            <li v-for="player in players" :key="player.id" class="flex justify-between items-center py-2 text-sm">
              <span>{{ player.name }}</span>
              <span v-if="player.name === user.nickname" class="text-lime-400 text-xs ml-2">
                (Tu)
              </span>
            </li>
          </ul>

          <!-- Timer -->
          <div v-if="isTimerActive"
            class="mx-auto w-[75px] h-[75px] flex items-center justify-center rounded-full border-[6px] font-bold text-xl transition-all duration-300"
            :class="seconds <= 10
              ? 'border-purple-600 text-purple-400'
              : 'border-lime-400 text-lime-400'
              ">
            {{ seconds }}
          </div>

          <!-- Esperando -->
          <div v-else class="text-center">
            <p class="text-lime-400 text-sm font-semibold">
              Temporitzador llest per iniciar
            </p>

            <!-- Botón para el creador -->
            <button v-if="isRoomCreator" @click="startTimer" :disabled="startingTimer"
              class="mt-3 px-4 py-2 rounded-md font-bold uppercase tracking-widest transition bg-lime-400 text-black hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed">
              {{ startingTimer ? "Iniciant..." : "Iniciar Temporitzador" }}
            </button>

            <p v-else class="text-gray-500 text-xs italic mt-2">
              Només el creador pot iniciar el temporitzador
            </p>
          </div>
        </div>

        <!-- Si no hay suficientes jugadores -->
        <div v-else class="text-center text-gray-400 space-y-1">
          <p class="text-sm">Esperant que s'uneixin més jugadors...</p>
          <p class="text-xs text-gray-500 italic">
            Es necessiten almenys 2 jugadors per començar
          </p>
        </div>
      </div>

      <!-- Botones de acción -->
      <div class="flex flex-wrap justify-center gap-3 mt-4 animate-fadeItem delay-[400ms]">
        <!-- Eliminar sala -->
        <button v-if="isRoomCreator" @click="deleteRoom" :disabled="deleting"
          class="border border-purple-600 text-purple-400 rounded-md px-4 py-2 font-bold uppercase text-sm hover:bg-purple-600 hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed">
          {{ deleting ? "Eliminant..." : "Eliminar panteó" }}
        </button>

        <!-- Salir -->
        <button @click="logout"
          class="border border-lime-400 text-lime-400 rounded-md px-4 py-2 font-bold uppercase text-sm hover:bg-lime-400 hover:text-black transition">
          Sortir del panteó
        </button>
      </div>
    </main>

    <!-- Footer -->
    <footer
      class="relative z-20 text-center text-xs text-gray-500 italic mt-8 tracking-widest animate-fadeItem delay-[500ms]">
      "La boira s'engruixeix... el final és a prop."
    </footer>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { socket } from "@/services/socket.js";
import Swal from "sweetalert2";
import snowImg from "@/assets/nice-snow.png";

const router = useRouter();
const user = useUserStore();
const players = ref([]);
const roomInfo = ref(null); // Información de la sala actual
const deleting = ref(false); // Estado de eliminación
const startingTimer = ref(false); // Estado de inicio de timer

const seconds = ref(0); // duración del temporizador - controlado por el servidor
const isTimerActive = ref(false); // estado del timer
const timerDuration = ref(30); // duración total del timer - sincronizada con el servidor

// Niebla progresiva según el temporizador
const fogStyle = computed(() => {
  // Solo mostrar niebla cuando el timer esté activo
  if (!isTimerActive.value) {
    return {
      opacity: 0,
      transition: "opacity 1s ease",
    };
  }

  const intensity = Math.max(
    0,
    Math.min(1, 1 - seconds.value / timerDuration.value)
  );

  // Empieza casi invisible y aumenta gradualmente
  const opacity = 0.1 + intensity * 0.7; // de 0.1 (inicio) a 0.8 (final)
  const brightness = 1 + intensity * 0.3; // de 1.0 a 1.3
  const contrast = 0.9 + intensity * 0.2; // de 0.9 a 1.1

  return {
    background: `url("${snowImg}") repeat`,
    backgroundSize: "600px 600px",
    opacity: opacity.toFixed(2),
    filter: `brightness(${brightness.toFixed(2)}) contrast(${contrast.toFixed(
      2
    )})`,
    transition: "opacity 1s ease, filter 1s ease", // suaviza la transición
  };
});

// Computed para verificar si el usuario actual es el creador de la sala
const isRoomCreator = computed(() => {
  return roomInfo.value && roomInfo.value.createdBy === user.nickname;
});

// Cuando el componente se monta
onMounted(() => {
  // Solicitar configuración del timer del servidor
  socket.emit("requestTimerConfig");

  // Escuchar configuración del timer desde el servidor
  socket.on("timerConfig", (config) => {
    timerDuration.value = config.duration;
    console.log(
      "Configuración del timer recibida:",
      config.duration,
      "segundos"
    );
  });

  // Escuchar actualizaciones del timer sincronizado desde el servidor
  socket.on("timerUpdate", (data) => {
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
      name: p.nickname ?? p.name ?? String(p),
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
    router.push("/");
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
    router.push("/");
  });
});

onUnmounted(() => {
  // Limpiar los listeners cuando el componente se desmonta
  cleanupSocketListeners();
});

async function deleteRoom() {
  if (!roomInfo.value) return;

  const result = await Swal.fire({
    title: "Eliminar panteó",
    text: `Estàs segur que vols eliminar el panteó "${roomInfo.value.roomName}"? Aquesta acció no es pot desfer.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
  });

  if (result.isConfirmed) {
    deleting.value = true;
    socket.emit("deleteRoom", {
      roomName: roomInfo.value.roomName,
      nickname: user.nickname,
    });
  }
}

function startTimer() {
  if (!roomInfo.value) return;

  console.log("Iniciant temporitzador...");
  startingTimer.value = true;

  socket.emit("startTimer", {
    roomName: roomInfo.value.roomName,
    nickname: user.nickname,
  });
}

function logout() {
  console.log("Sortint de la sala...");

  // Limpiar listeners antes de salir
  cleanupSocketListeners();

  // Si hay información de la sala, notificar al servidor que salimos
  if (roomInfo.value) {
    console.log(`Notificant sortida de la sala: ${roomInfo.value.roomName}`);
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
  socket.off("timerConfig");
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
<style scoped>
@keyframes fogMove {
  0% {
    background-position: 0 0;
  }

  100% {
    background-position: 1000px 0;
  }
}

.fog-animated {
  animation: fogMove 60s linear infinite !important;
}

/* Animaciones del panel y contenido */
@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: scale(0.95);
    filter: brightness(0.5);
  }

  100% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1);
  }
}

@keyframes fadeItem {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.8s ease-out forwards;
}

.animate-fadeItem {
  animation: fadeItem 0.8s ease-out forwards;
  opacity: 0;
}
</style>
