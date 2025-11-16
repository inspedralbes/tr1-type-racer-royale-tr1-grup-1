<template>
  <section
    class="relative flex flex-col items-center min-h-screen text-gray-200 bg-gradient-to-b from-[#0B0C10] to-[#1F2833] overflow-hidden font-dogica"
  >
    <!-- Fondo con imagen -->
    <img
      src="/src/assets/opt2_img1.png"
      alt="Zombie sky background"
      class="absolute inset-0 object-cover w-full h-full opacity-80"
    />
    <div class="absolute inset-0 bg-black/30"></div>
    <!-- capa de niebla animada -->
    <div class="bg-fog absolute inset-0 z-10 pointer-events-none"></div>

    <!-- Contenido principal -->
    <main
      class="relative z-20 w-full max-w-fit mx-auto px-6 py-10 space-y-8 animate-fadeIn"
    >
      <!-- TÍTULO -->
      <h1
        class="text-3xl md:text-4xl text-lime-400 text-center drop-shadow-[0_0_15px_#66FCF1] tracking-widest"
      >
        The Lost Word
      </h1>

      <!-- MENSAJE DE ERROR (si falta nick) -->
      <p
        v-if="route.query.needNick"
        class="bg-red-900/40 border border-red-500 text-red-300 p-3 rounded-md text-sm text-center font-dogica animate-fadeItem delay-[100ms]"
      >
        Si us plau, introdueix un nom d'usuari abans d'unirte a un panteó.
      </p>

      <!-- INPUT NICKNAME - Estilo mockup correcto -->
      <div class="animate-fadeItem delay-[200ms]">
        <input
          id="nickname-input"
          v-model.trim="nick"
          type="text"
          placeholder="Nom d'usuari"
          @keyup.enter="join"
          autofocus
          class="mockup-input-correct w-full max-w-lg mx-auto block bg-transparent text-lime-400 border border-lime-400 rounded-lg px-4 py-2 focus:outline-none focus:border-lime-300 placeholder-gray-400 text-center"
        />
      </div>

      <!-- LÁPIDAS CORRECTAS (mockup style) -->
      <div class="animate-fadeItem delay-[300ms] w-fit mx-auto">
        <!-- Sin salas -->
        <div v-if="rooms.length === 0" class="text-gray-400 italic text-center">
          No hi ha panteons disponibles.
        </div>

        <!-- Con salas - Lápidas en fila horizontal -->
        <div v-else class="flex flex-wrap justify-center gap-8 w-fit mx-auto">
          <div
            v-for="room in rooms"
            :key="room.name"
            class="relative w-fit tombstone-mockup-correct"
          >
            <!-- Lápida -->
            <div class="relative w-[300px] h-[280px] mx-auto">
              <img
                src="/src/assets/lapida.png"
                class="w-full h-auto object-contain drop-shadow-xl"
                alt="Lápida"
              />

              <!-- CONTENIDO DENTRO DE LA LÁPIDA -->
              <div class="tombstone-content-layout">
                <!-- NOMBRE DE LA SALA -->
                <h2 class="tombstone-title">
                  {{ room.name }}
                </h2>

                <!-- INFORMACIÓN DE LA SALA -->
                <div class="tombstone-info">
                  <p>
                    <span>Jugadors:</span>
                    {{ room.playerCount }}
                  </p>
                  <p>
                    <span>Idioma:</span>
                    {{ room.language }}
                  </p>
                  <p>
                    <span>Dificultat:</span>
                    {{ translateDifficulty(room.difficulty) }}
                  </p>
                  <p>
                    <span>Estat:</span>
                    {{ translateStatus(room.status || "waiting") }}
                  </p>
                </div>

                <!-- BOTÓN DENTRO DE LA LÁPIDA -->
                <div class="tombstone-button-container">
                  <button
                    class="tombstone-button"
                    :disabled="
                      !nick?.trim() ||
                      nicknameExists(room) ||
                      room.status !== 'waiting'
                    "
                    @click="
                      user.setNickname(nick);
                      socket.emit('joinRoom', {
                        roomName: room.name,
                        nickname: user.nickname,
                      });
                    "
                  >
                    UNIR-SE
                  </button>
                </div>
              </div>
            </div>

            <!-- MENSAJE DE ERROR BAJO LA LÁPIDA -->
            <p
              class="text-red-400 text-center mt-2 font-dogica text-sm drop-shadow-lg h-5"
            >
              {{ nicknameExists(room) ? "Nom ja en ús" : "" }}
            </p>
          </div>
        </div>
      </div>

      <!-- BOTÓN CREAR SALA -->
      <div class="animate-fadeItem delay-[400ms]">
        <button
          @click="goToCreateRoom"
          :disabled="!nick?.trim()"
          class="w-full py-2 rounded-md border border-lime-400 text-lime-400 font-bold uppercase tracking-widest hover:bg-lime-400 hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Crear Nou Panteo
        </button>

        <!-- MENSAJE DE ERROR -->
        <p class="text-red-400 text-center mt-2 font-dogica text-sm h-5">
          {{
            !nick?.trim()
              ? "Introdueix un nom d'usuari per crear un panteó"
              : ""
          }}
        </p>
      </div>

      <!-- FRASE FINAL -->
      <footer
        class="text-center text-xs text-gray-400 italic mt-6 tracking-widest animate-fadeItem delay-[500ms] drop-shadow-lg"
      >
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
  user.setRoomName(data.roomName);
  console.log(`Te has unido a la sala ${data.roomName}`, data);
  router.push("/lobby");
});

// Mantener el listener userJoined para notificaciones generales
socket.on("userJoined", (data) => {
  // También guardar el roomName aquí por si acaso
  if (data.nickname === user.nickname) {
    user.setRoomName(data.roomName);
  }
  console.log(
    `${data.nickname} se unió a la sala ${data.roomName}, id: ${data.playerId}`
  );
});

// Escuchar error al unirse
socket.on("errorJoin", () => {
  Swal.fire({
    icon: "error",
    title: "Error",
    text: "No s'ha pogut unir al panteó. El panteó no existeix o no està disponible.",
  });
});

function nicknameExists(room) {
  if (!nick.value?.trim()) return false;
  return room.players?.some(
    (p) => p.nickname.toLowerCase() === nick.value.trim().toLowerCase()
  );
}

function translateStatus(status) {
  const translations = {
    waiting: "esperant",
    inGame: "jugant",
    finished: "finalitzada",
  };
  return translations[status] || status;
}

function translateDifficulty(difficulty) {
  if (typeof difficulty === "number") {
    if (difficulty === 1) return "fàcil";
    if (difficulty === 2) return "intermig";
    if (difficulty === 3) return "difícil";
  }
  if (typeof difficulty === "string") {
    if (difficulty === "facil") return "fàcil";
    if (difficulty === "intermig") return "intermig";
    if (difficulty === "dificil") return "difícil";
  }
  return "N/A";
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

.mockup-input-correct {
  font-family: "dogica", monospace;
  border-width: 1px;
  box-shadow: 0 0 8px rgba(163, 230, 53, 0.2), 0 0 15px rgba(163, 230, 53, 0.1);
  background: rgba(0, 0, 0, 0.05);
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
  font-size: 14px;
}

.mockup-input-correct:focus {
  box-shadow: 0 0 12px rgba(163, 230, 53, 0.3),
    0 0 20px rgba(163, 230, 53, 0.15);
  border-color: #84cc16;
}

.mockup-input-correct::placeholder {
  color: rgba(163, 230, 53, 0.5);
}

/* Lápida estilo mockup correcto */
.tombstone-mockup-correct {
  animation: fadeInTombstoneCorrect 0.8s ease-out forwards;
}

@keyframes fadeInTombstoneCorrect {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tombstone-container-correct {
  position: relative;
  transition: transform 0.2s ease;
}

.tombstone-container-correct:hover {
  transform: translateY(-2px);
}

.tombstone-image-correct {
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.6));
}

.tombstone-text-correct {
  pointer-events: none;
}

/* Información DENTRO de la lápida */
.room-info-correct {
  font-family: "dogica", monospace;
}

/* Título destacado como 'PANTEONS' en el mockup */
.tombstone-title-highlight {
  font-family: "dogica", monospace;
  text-shadow: 0 0 8px #a3e635, 0 0 15px #a3e635,
    0 0 20px rgba(163, 230, 53, 0.6);
  letter-spacing: 2px;
}

/* Layout mockup para info de la sala */
.room-info-mockup {
  font-family: "dogica", monospace;
}

/* Efecto glow sutil para texto */
.glow-text-subtle {
  text-shadow: 0 0 3px currentColor, 0 0 6px currentColor,
    0 0 9px rgba(163, 230, 53, 0.5);
}

/* Botón estilo mockup correcto */
.mockup-button-correct {
  font-family: "dogica", monospace;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 0 10px rgba(163, 230, 53, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.mockup-button-correct:hover:not(:disabled) {
  box-shadow: 0 0 15px rgba(163, 230, 53, 0.6), 0 4px 8px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

.mockup-button-correct:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Botón dentro de la lápida */
.mockup-button-inside {
  font-family: "dogica", monospace;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 0 10px rgba(163, 230, 53, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  z-index: 10;
  pointer-events: auto;
}

.mockup-button-inside:hover:not(:disabled) {
  box-shadow: 0 0 15px rgba(163, 230, 53, 0.6), 0 4px 8px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

.mockup-button-inside:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Estilos específicos para el contenido de la lápida */
.tombstone-content-layout {
  position: absolute;
  top: 30px;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  /* Ajustar padding para respetar la forma de la lápida */
  padding-top: 50px; /* Más espacio arriba por la forma redondeada */
  padding-bottom: 60px; /* Espacio para el botón en la base */
  padding-left: 85px; /* Margen lateral respetando bordes */
  padding-right: 85px; /* Margen lateral respetando bordes */
}

.tombstone-title {
  color: #a3e635;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  font-family: "dogica", monospace;
  letter-spacing: 0.1em;
  line-height: 1.2;
  margin-bottom: 10px;
}

.tombstone-info {
  color: white;
  font-size: 9px;
  font-family: "dogica", monospace;
  line-height: 1.3;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 2px;
  padding-top: 10px;
}

.tombstone-info p {
  margin: 2px;
}

.tombstone-info span {
  color: #a3e635;
}

.tombstone-button-container {
  display: flex;
  justify-content: center;
  margin-top: 40px;
}

.tombstone-button {
  padding: 6px 16px;
  background-color: #a3e635;
  color: black;
  border-radius: 6px;
  font-family: "dogica", monospace;
  font-size: 8px;
  font-weight: bold;
  letter-spacing: 0.05em;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  max-width: 100px;
}

.tombstone-button:hover:not(:disabled) {
  background-color: #84cc16;
  transform: translateY(-1px);
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.4);
}

.tombstone-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
