<template>
  <section
    class="relative flex flex-col items-center min-h-screen text-gray-200 bg-gradient-to-b from-[#0B0C10] to-[#1F2833] overflow-hidden font-dogica">
    <!-- Fondo con imagen -->
    <img src="/src/assets/halloween_night.jpg" alt="Zombie sky background"
      class="absolute inset-0 object-cover w-full h-full opacity-80" />
    <div class="absolute inset-0 bg-black/30"></div>
    <!-- capa de niebla animada -->
    <div class="bg-fog absolute inset-0 z-10 pointer-events-none"></div>

    <!-- Contenido principal -->
    <main class="relative z-20 w-full max-w-xl px-6 py-10 space-y-8 animate-fadeIn">
      <!-- TÍTULO -->
      <h1 class="text-3xl md:text-4xl text-lime-400 text-center drop-shadow-[0_0_15px_#66FCF1] tracking-widest">
        The Last Word
      </h1>

      <!-- MENSAJE DE ERROR (si falta nick) -->
      <p v-if="route.query.needNick"
        class="bg-red-900/40 border border-red-500 text-red-300 p-3 rounded-md text-sm text-center font-dogica animate-fadeItem delay-[100ms]">
        Si us plau, introdueix un nom d'usuari abans d'unirte a una sala.
      </p>

      <!-- INPUT NICKNAME -->
      <div class="bg-black/40 border border-lime-400 rounded-lg p-4 space-y-2 shadow-lg animate-fadeItem delay-[200ms]">
        <label class="block text-lime-300 font-semibold text-sm uppercase tracking-widest">
          Nom d'usuari
        </label>
        <input v-model.trim="nick" type="text" placeholder="El teu nom" @keyup.enter="join" autofocus
          class="w-full bg-gray-900/60 text-lime-200 border border-lime-400 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400 placeholder-gray-500" />
        <small v-if="user.hasNick" class="text-emerald-400 text-xs block mt-1">
          ✓ Identificat com: {{ user.nickname }}
        </small>
      </div>

      <!-- LISTA DE SALAS -->
      <div class="bg-black/40 border border-lime-400 rounded-lg p-4 shadow-lg space-y-3 animate-fadeItem delay-[300ms]">
        <h2 class="text-xl font-bold text-lime-400 mb-2 flex items-center gap-2 uppercase tracking-wider">
          Sales disponibles
        </h2>

        <!-- Sin salas -->
        <div v-if="rooms.length === 0" class="text-gray-400 italic">
          No hi ha sales disponibles.
        </div>

        <!-- Con salas -->
        <ul v-else class="space-y-3">
          <li v-for="room in rooms" :key="room.name"
            class="p-3 bg-gray-800/50 border border-gray-700 rounded-md flex flex-col gap-2 hover:bg-gray-700/40 transition">
            <div class="flex justify-between items-center">
              <div>
                <div class="font-semibold text-lime-300 text-sm">
                  {{ room.name }}
                </div>
                <div class="text-xs text-gray-400 leading-snug">
                  Jugadors: {{ room.playerCount }} · Estat:
                  {{ room.status || "waiting" }}<br />
                  Idioma: {{ room.language }} · Dificultat:
                  {{ room.difficulty }}
                  <span v-if="room.createdBy">
                    · Creada per: {{ room.createdBy }}
                  </span>
                </div>
              </div>

              <button
                class="px-3 py-1 bg-lime-400 text-black rounded-md font-bold text-xs hover:bg-lime-300 transition disabled:opacity-50"
                :disabled="!nick?.trim() || nicknameExists(room)" @click="
                  user.setNickname(nick);
                socket.emit('joinRoom', {
                  roomName: room.name,
                  nickname: user.nickname,
                });
                ">
                {{ nicknameExists(room) ? "Nom ja en ús" : "Unir-se" }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- BOTÓN CREAR SALA -->
      <button @click="goToCreateRoom" :disabled="!nick?.trim()"
        class="w-full py-2 rounded-md border border-lime-400 text-lime-400 font-bold uppercase tracking-widest hover:bg-lime-400 hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed animate-fadeItem delay-[400ms]">
        {{
          !nick?.trim()
            ? "Introdueix un nom d'usuari per crear una sala"
            : "Crear Nova Sala"
        }}
      </button>

      <!-- FRASE FINAL -->
      <footer class="text-center text-xs text-gray-500 italic mt-6 tracking-widest animate-fadeItem delay-[500ms]">
        "Només els més precisos sobreviuran fins a l'alba..."
      </footer>
    </main>
  </section>
</template>
<script setup>
import { ref, watchEffect, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useUserStore } from "@/stores/user";
import { socket } from "@/services/socket.js";
import Swal from "sweetalert2";

const router = useRouter();
const route = useRoute();
const user = useUserStore();
const rooms = ref([]);

const nick = ref(user.nickname);

// Clear the banner once the user types
watchEffect(() => {
  if (route.query.needNick && nick.value) {
    router.replace({ query: {} });
  }
});

// Solicitar lista de salas cuando se monta el componente
onMounted(() => {
  socket.emit("requestRoomList");
});

// Escuchar lista de salas del servidor
socket.on("roomList", (data) => {
  console.log("Salas disponibles:", data.rooms);
  rooms.value = data.rooms;
});

// Escuchar cuando el usuario se une exitosamente a una sala
socket.on("joinedRoom", (data) => {
  user.setId(data.playerId);
  user.setNickname(data.nickname);
  console.log(`Te has unido a la sala ${data.roomName}`);
  router.push("/lobby");
});

// Mantener el listener userJoined para notificaciones generales
socket.on("userJoined", (data) => {
  console.log(`${data.nickname} se unió a la sala ${data.roomName}, id: ${data.playerId}`);
});

// Escuchar error al unirse
socket.on("errorJoin", () => {
  Swal.fire({
    icon: "error",
    title: "Error",
    text: "No s'ha pogut unir a la sala. La sala no existeix o no està disponible.",
  });
});

function nicknameExists(room) {
  if (!nick.value?.trim()) return false;
  return room.players?.some(
    (p) => p.nickname.toLowerCase() === nick.value.trim().toLowerCase()
  );
}

function joinRoom(roomName) {
  if (!nick.value?.trim()) return;

  user.setNickname(nick.value);

  // Emitir evento para unirse a la sala
  socket.emit("joinRoom", { roomName, nickname: user.nickname });

  // Escuchar confirmación y redireccionar
  socket.once("userJoined", (data) => {
    console.log(`Te has unido a la sala ${data.roomName}`);
    router.push("/lobby");
  });
}

function goToCreateRoom() {
  if (!nick.value?.trim()) return;

  // Guardar el nickname antes de ir a crear sala
  user.setNickname(nick.value);
  router.push("/createRoom");
}

function join() {
  if (!nick.value?.trim()) return;
  user.setNickname(nick.value);
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

.bg-fog {
  background: url("/src/assets/nice-snow.png");
  background-repeat: repeat;
  background-size: 600px 600px;
  opacity: 0.5;
  /* prueba con 0.3 o 0.4 */
  filter: brightness(1.3) contrast(0.8);
  animation: fogMove 60s linear infinite;
  z-index: 10;
  pointer-events: none;
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
