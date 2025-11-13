<template>
  <section
    class="relative min-h-screen flex flex-col items-center justify-start px-6 py-8 font-dogica text-gray-200 bg-gradient-to-b from-[#0B0C10] to-[#1F2833] overflow-hidden">
    <!-- Fondo e iluminación -->
    <img src="/src/assets/halloween_night.jpg" alt="Zombie sky background"
      class="absolute inset-0 w-full h-full object-cover opacity-80" />
    <div class="absolute inset-0 bg-black/40"></div>
    <!-- capa de niebla animada -->
    <div class="bg-fog absolute inset-0 z-10 pointer-events-none"></div>

    <!-- Contenido principal -->
    <main class="relative z-20 w-full max-w-6xl space-y-6 animate-fadeIn">
      <!-- Header con estadísticas -->
      <header class="flex flex-col lg:flex-row items-center justify-between gap-4 animate-fadeItem delay-[100ms]">
        <h1 class="text-3xl text-lime-400 font-bold drop-shadow-[0_0_15px_#66FCF1] text-center tracking-widest">
          Prova de Mecanografia
        </h1>

        <div class="flex flex-wrap gap-6 text-sm">
          <div class="text-center">
            <div class="text-lime-400 font-semibold">PPM</div>
            <div class="text-2xl text-lime-300">{{ wpm }}</div>
          </div>
          <div class="text-center">
            <div class="text-lime-400 font-semibold">Precisió</div>
            <div class="text-2xl text-lime-300">{{ accuracy }}%</div>
          </div>
          <div class="text-center">
            <div class="text-lime-400 font-semibold">Temps</div>
            <div class="text-2xl text-lime-300">{{ elapsedSeconds }}s</div>
          </div>
        </div>
      </header>

      <!-- Área de texto principal -->
      <section class="bg-black/40 border border-lime-400 rounded-lg p-6 shadow-lg animate-fadeItem delay-[200ms]"
        @click="focusInput">
        <!-- Estados de carga y error -->
        <div v-if="loading" class="text-center py-12 text-lime-400">
          Carregant text...
        </div>
        <div v-else-if="error" class="text-center py-12 text-red-400">
          {{ error }}
        </div>

        <!-- Contenido del texto -->
        <div v-else class="text-wrapper relative" ref="textWrapper">
          <span v-for="(ch, i) in targetChars" :key="i" :class="charClass(i)">{{
            ch
          }}</span>
          <!-- blinking caret positioned dynamically -->
          <span v-if="!finished" class="caret" :style="caretStyle"></span>
        </div>

        <!-- hidden input to capture keyboard, mobile-friendly -->
        <textarea ref="hiddenInput" v-model="userInput" class="hidden-input" @input="onInput" @keydown="onKeydown"
          @paste.prevent :maxlength="target.length" aria-label="Typing input"></textarea>
      </section>

      <!-- Progreso de la carrera -->
      <section v-if="raceState.length"
        class="bg-black/40 border border-lime-400 rounded-lg p-4 shadow-lg animate-fadeItem delay-[300ms]">
        <h3 class="text-lime-400 font-semibold text-lg mb-4">
          Progres de la carrera
        </h3>
        <div class="space-y-3">
          <div v-for="p in raceState" :key="p.nickname" class="flex items-center gap-3">
            <span class="text-lime-300 font-semibold min-w-[120px]">{{
              p.nickname
            }}</span>
            <div class="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                class="bar h-full bg-gradient-to-r from-lime-400 to-lime-300 rounded-full transition-all duration-300"
                :style="{ width: (p.position * 2) + 'px' }"></div>
            </div>
            <small class="text-gray-400 min-w-[40px] text-right">{{ p.position }} pts</small>
          </div>
        </div>
      </section>

      <!-- Jugadores en la sala -->
      <section v-if="participants.length > 0"
        class="bg-black/40 border border-lime-400 rounded-lg p-4 shadow-lg animate-fadeItem delay-[400ms]">
        <h3 class="text-lime-400 font-semibold text-lg mb-4">
          Jugadors a la sala:
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="nick in participants" :key="nick" class="bg-gray-800/50 border border-gray-700 rounded-md p-3">
            <div class="text-lime-300 font-semibold">{{ nick }}</div>
            <div class="text-sm text-gray-400">
              PPM: {{ findResult(nick)?.wpm ?? "-" }}
            </div>
            <div class="text-sm text-gray-400">
              Precisió: {{ findResult(nick)?.accuracy ?? "-" }}%
            </div>
          </div>
        </div>
      </section>

      <!-- Resultados de la sala -->
      <section v-if="gameResults.length > 0"
        class="bg-black/40 border border-lime-400 rounded-lg p-4 shadow-lg animate-fadeItem delay-[500ms]">
        <h3 class="text-lime-400 font-semibold text-lg mb-4">
          Resultats de la sala:
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="result in gameResults" :key="result.timestamp"
            class="bg-gray-800/50 border border-gray-700 rounded-md p-3">
            <div class="text-lime-300 font-semibold">{{ result.nickname }}</div>
            <div class="text-sm text-gray-400">PPM: {{ result.wpm }}</div>
            <div class="text-sm text-gray-400">
              Precisió: {{ result.accuracy }}%
            </div>
          </div>
        </div>
      </section>

      <!-- Botones de control -->
      <footer class="flex flex-wrap justify-center gap-2 animate-fadeItem delay-[600ms]">
        <button @click="reset"
          class="px-3 py-1 text-sm border border-lime-400 text-lime-400 rounded-md font-bold uppercase tracking-wider hover:bg-lime-400 hover:text-black transition">
          Reiniciar
        </button>
        <button @click="nextText"
          class="px-3 py-1 text-sm border border-lime-400 text-lime-400 rounded-md font-bold uppercase tracking-wider hover:bg-lime-400 hover:text-black transition">
          Següent Text
        </button>
        <button @click="$router.push('/')"
          class="px-3 py-1 text-sm border border-red-600 text-red-400 rounded-md font-bold uppercase tracking-wider hover:bg-red-600 hover:text-black transition">
          Sortir
        </button>
      </footer>
    </main>

    <!-- Teclado -->
    <div class="relative z-20 w-full animate-fadeItem delay-[700ms]">
      <Keyboard :nickname="user.nickname" :room="ROOM" />
    </div>

    <!-- Footer -->
    <footer
      class="relative z-20 text-center text-xs text-gray-500 italic mt-8 tracking-widest animate-fadeItem delay-[800ms]">
      "Cada paraula conta... La supervivència depèn de la velocitat."
    </footer>
  </section>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { getText } from "@/services/communicationManager.js";
import { socket } from "@/services/socket";
import { useToast } from "vue-toastification";

import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";
import Keyboard from "@/components/Keyboard.vue";
const router = useRouter();
const user = useUserStore();
const toast = useToast();

// Variables para la sala dinámica
const roomList = ref([]);
const currentRoom = ref(null);

// Computed para obtener el nombre de la sala actual
const ROOM = computed(() => {
  if (currentRoom.value) {
    return currentRoom.value.name;
  }
  // Buscar en la lista de salas la que contiene al usuario actual
  const userRoom = roomList.value.find(
    (room) =>
      room.players &&
      room.players.some((player) =>
        typeof player === "string"
          ? player === user.nickname
          : player.nickname === user.nickname
      )
  );
  return userRoom ? userRoom.name : "";
});

if (!user.hasNick) router.replace({ name: "home", query: { needNick: "1" } });

// DATA LOADING
const current = ref(null);
const target = ref("");
const loading = ref(true);
const error = ref(null);
const gameResults = ref([]);
const participants = ref([]); // <-- nueva ref para participantes
const targetChars = computed(() => Array.from(target.value));

// RACE STATE (from server)
const raceState = ref([]);
socket.on("race:update", (snapshot) => {
  raceState.value = snapshot || [];
});

const totalErrors = ref(0);
const lastTypedLength = ref(0);
const lastWpmEmit = ref(0);

async function pickRandomText() {
  try {
    const randomId = Math.floor(Math.random() * 10) + 1;
    const data = await getText(randomId);
    const text = data.text ?? data.TEXT_CONTENT ?? data.TEXT;
    current.value = data;
    target.value = text ?? "";
  } catch (err) {
    console.error("Error cargando texto:", err);
    error.value = "Error al cargar el texto. ¿Está el servidor funcionando?";
  } finally {
    loading.value = false;
  }
}

// TYPING STATE
const hiddenInput = ref(null);
const textWrapper = ref(null);
const userInput = ref("");
const startedAt = ref(null);
const endedAt = ref(null);
const finished = computed(
  () => userInput.value.length >= target.value.length && target.value.length > 0
);

const typedChars = computed(() => userInput.value.length);
const correctChars = computed(() => {
  let ok = 0;
  for (let i = 0; i < userInput.value.length; i++) {
    if (userInput.value[i] === target.value[i]) ok++;
  }
  return ok;
});

const elapsedMs = computed(() => {
  if (!startedAt.value) return 0;
  const end = endedAt.value ?? Date.now();
  return Math.max(0, end - startedAt.value);
});
const elapsedSeconds = computed(() => Math.floor(elapsedMs.value / 1000));
const minutes = computed(() => (elapsedMs.value || 1) / 60000);
const wpm = computed(() => {
  const words = correctChars.value / 5;
  return Math.max(0, Math.round(words / minutes.value));
});
const accuracy = computed(() => {
  if (typedChars.value === 0) return 100;
  return Math.round((correctChars.value / typedChars.value) * 100);
});

// CARET POSITION
const caretStyle = computed(() => {
  const pos = userInput.value.length;
  if (!textWrapper.value) {
    return { position: "absolute", left: "0px", top: "0px" };
  }
  const spans = textWrapper.value.querySelectorAll("span");
  if (pos === 0) {
    return { position: "absolute", left: "0px", top: "0px" };
  }
  if (spans[pos - 1]) {
    const rect = spans[pos - 1].getBoundingClientRect();
    const containerRect = textWrapper.value.getBoundingClientRect();
    return {
      position: "absolute",
      left: `${rect.right - containerRect.left}px`,
      top: `${rect.top - containerRect.top}px`,
    };
  }
  return { position: "absolute", left: "0px", top: "0px" };
});

// CLASS LOGIC
function charClass(i) {
  const typed = userInput.value[i];
  if (i < userInput.value.length) {
    if (typed === target.value[i]) return "char correct";
    return "char wrong";
  }
  if (i === userInput.value.length) return "char current";
  return "char untouched";
}

// --- RACE: emit progress (simplificado a +1/-1) ---
let lastEmit = 0;
const EMIT_MS = 100; // más sensible, puedes subir a 250ms

function emitProgressThrottled() {
  const now = performance.now();
  if (now - lastEmit < EMIT_MS) return;
  lastEmit = now;

  if (userInput.value.length === 0) return;

  const pos = userInput.value.length - 1;
  const correct = target.value[pos] === userInput.value[pos];
  const delta = correct ? 1 : -1;

  socket.emit("typing:progress", {
    room: ROOM.value,
    nickname: user.nickname,
    delta,
  });
}


// INPUT HANDLERS
function onInput() {
  if (!startedAt.value && userInput.value.length > 0) {
    startedAt.value = Date.now();
  }

  if (userInput.value.length > target.value.length) {
    userInput.value = userInput.value.slice(0, target.value.length);
  }

  // --- NUEVO: conteo acumulativo de errores ---
  const len = userInput.value.length;
  const diff = len - lastTypedLength.value;

  if (diff > 0) {
    // Usuario escribió nuevos caracteres
    for (let i = lastTypedLength.value; i < len; i++) {
      if (userInput.value[i] !== target.value[i]) {
        totalErrors.value++;
        console.log("Nuevo error acumulado:", totalErrors.value);
      }
    }
  }

  lastTypedLength.value = len;

  // Emitir cada vez que los errores acumulados sean múltiplo de 5 (y mayor que 0)
  if (totalErrors.value > 0 && totalErrors.value % 5 === 0) {
    console.log(
      "Enviando notificación de bajo rendimiento (múltiplo de 5):",
      totalErrors.value
    );
    socket.emit("userPerformance", {
      room: ROOM.value,
      nickname: user.nickname,
      status: "bad",
      message: `${user.nickname} está teniendo dificultades (${totalErrors.value} errores).`,
    });
  }

  // Finalización
  emitProgressThrottled();

  if (finished.value && !endedAt.value) {
    endedAt.value = Date.now();

    // Enviar resultados al servidor
    socket.emit("gameFinished", {
      room: ROOM.value,
      nickname: user.nickname,
      wpm: wpm.value,
      accuracy: accuracy.value,
      errors: totalErrors.value,
    });
  }
}

function onKeydown(e) {
  if (e.key === "Tab") e.preventDefault();
}

// CONTROL
function focusInput() {
  hiddenInput.value?.focus();
}

function reset() {
  userInput.value = "";
  startedAt.value = null;
  endedAt.value = null;
  totalErrors.value = 0; // 🔹 resetear errores
  lastTypedLength.value = 0;
  focusInput();
}

async function nextText() {
  await pickRandomText();
  reset();
}

// MOUNT
onMounted(async () => {
  // Solicitar lista de salas primero
  socket.emit("requestRoomList");

  // Escuchar actualizaciones de la lista de salas
  socket.on("roomList", (data) => {
    roomList.value = data.rooms || [];
    console.log("Lista de salas actualizada:", roomList.value);

    // Buscar la sala del usuario actual
    const userRoom = roomList.value.find(
      (room) =>
        room.players &&
        room.players.some((player) =>
          typeof player === "string"
            ? player === user.nickname
            : player.nickname === user.nickname
        )
    );

    if (userRoom) {
      currentRoom.value = userRoom;
      console.log("Sala actual del usuario:", userRoom.name);
    }
  });

  // Join the room when socket connects and we have room info
  socket.on("connect", () => {
    if (ROOM.value) {
      socket.emit("joinRoom", {
        roomName: ROOM.value,
        nickname: user.nickname,
      });
    }
  });

  // Sala: resultados
  socket.on("updateGameResults", (results) => {
    gameResults.value = results;
    console.log("Resultados actualizados:", results);
  });

  toast.info("Conectado al servidor de notificaciones.");

  socket.on("userPerformance", (data) => {
    console.log("Notificación de rendimiento:", data);
    if (data.nickname !== user.nickname) {
      toast.info(data.message, { timeout: 2500 });
    }
  });

  // Escuchar lista de usuarios en la sala
  socket.on("updateUserList", (list) => {
    participants.value = list || [];
    console.log(" Lista de usuarios actualizada:", participants.value);
  });

  await pickRandomText();
  await nextTick();

  if (target.value === "") {
    const interval = setInterval(() => {
      if (target.value) {
        clearInterval(interval);
        focusInput();
      }
    }, 100);
  } else {
    loading.value = false;
    focusInput();
  }
});

onBeforeUnmount(() => {
  socket.off("updateGameResults");
  socket.off("userPerformance");
  socket.off("race:update");
  socket.off("connect");
  socket.off("roomList");
});

// When target changes (Next Text), reset everything
watch(
  () => target.value,
  () => {
    reset();
  }
);

// Watch userInput to update caret position
watch(
  () => userInput.value,
  async () => {
    await nextTick();
  }
);

// utility para buscar resultado por nickname
function findResult(nick) {
  return gameResults.value.find((r) => r.nickname === nick);
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
  opacity: 0.3;
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

/* Área de texto principal */
.text-wrapper {
  position: relative;
  color: #9ca3af;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.8;
  font-size: 1.1rem;
  min-height: 120px;
  cursor: text;
  user-select: none;
}

/* Characters styling */
.char {
  position: relative;
}

.untouched {
  opacity: 0.6;
  color: #6b7280;
}

.correct {
  color: #a3e635;
  background-color: rgba(16, 185, 129, 0.1);
}

.wrong {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.2);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.current {
  color: #a3e635;
  background-color: rgba(101, 252, 241, 0.2);
}

/* Caret animado */
.caret {
  display: inline-block;
  width: 2px;
  height: 1.4em;
  background: #a3e635;
  position: absolute;
  z-index: 1;
  animation: blink 1s ease-in-out infinite;
  box-shadow: 0 0 5px #a3e635;
}

@keyframes blink {

  0%,
  50% {
    opacity: 1;
  }

  51%,
  100% {
    opacity: 0;
  }
}

/* Hidden input overlay */
.hidden-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  color: transparent;
  background: transparent;
  border: none;
  resize: none;
  cursor: text;
  caret-color: transparent;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  padding: inherit;
  outline: none;
  z-index: 5;
}

/* Scrollbar personalizado */
.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #a3e635;
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #45a29e;
}
</style>
