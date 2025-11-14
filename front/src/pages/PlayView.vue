<template>
  <section
    class="relative min-h-screen flex flex-col px-6 py-8 font-dogica text-gray-200 bg-gradient-to-b from-[#0B0C10] to-[#1F2833] overflow-hidden"
  >
    <!-- FONDO EN CAPAS -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute inset-0 bg-layer-1 z-0"></div>
      <div class="bg-fog absolute inset-0 z-7 pointer-events-none"></div>
      <div class="absolute inset-0 bg-layer-2 z-5"></div>
      <div class="absolute inset-0 bg-black/40"></div>
      <div class="absolute inset-0 bg-layer-3 z-10"></div>
    </div>

    <!-- CONTENIDO -->
    <main
      class="relative z-30 w-full max-w-6xl mx-auto flex flex-col gap-6 animate-fadeIn"
    >
      <!-- 1. TEXTOS Y ESTADÍSTICAS (HEADER MANTENIDO) -->
      <header
        class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeItem delay-[100ms]"
      >
        <h1
          class="text-3xl text-lime-400 font-bold drop-shadow-[0_0_15px_#66FCF1] tracking-widest"
        >
          Cambiar titulo
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

      <!-- 2. LAYOUT PRINCIPAL: SIDEBAR IZQUIERDO + ÁREA DE TEXTO + PANEL DERECHO -->
      <section
        class="grid grid-cols-1 lg:grid-cols-6 gap-6 animate-fadeItem delay-[200ms]"
      >
        <!-- SIDEBAR IZQUIERDO: INFO DE SALA Y POSICIONES -->
        <div class="lg:col-span-2 space-y-4">
          <!-- INFO DE LA SALA -->
          <div class="bg-black/40 border border-lime-400 rounded-lg p-4">
            <h3 class="text-lime-400 font-semibold text-lg mb-3">
              Informació del panteó
            </h3>
            <p class="text-gray-300 text-sm">Panteó: {{ ROOM }}</p>
            <p class="text-gray-300 text-sm">Jugador: {{ user.nickname }}</p>
            <p class="text-gray-300 text-sm">
              Jugadors: {{ participants.length }}
            </p>
          </div>

          <!-- POSICIONES EN TIEMPO REAL -->
          <div class="bg-black/40 border border-lime-400 rounded-lg p-4">
            <h3 class="text-lime-400 font-semibold text-lg mb-3">Posicions</h3>
            <div class="space-y-2">
              <div
                v-for="p in raceState"
                :key="p.nickname"
                class="flex justify-between text-sm"
              >
                <span class="text-lime-300">{{ p.nickname }}</span>
                <span class="text-gray-200">{{ p.position }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ÁREA CENTRAL: TEXTO Y TECLADO -->
        <div class="lg:col-span-3 space-y-4">
          <!-- ÁREA DE TEXTO A ESCRIBIR -->
          <div
            class="bg-black/70 border border-lime-400 rounded-lg p-4 shadow-lg"
            @click="focusInput"
          >
            <div v-if="loading" class="text-center py-12 text-lime-400">
              Carregant text...
            </div>
            <div v-else-if="error" class="text-center py-12 text-red-400">
              {{ error }}
            </div>

            <div v-else class="text-wrapper relative" ref="textWrapper">
              <span
                v-for="(ch, i) in targetChars"
                :key="i"
                :class="charClass(i)"
                >{{ ch }}</span
              >
              <span v-if="!finished" class="caret" :style="caretStyle"></span>
            </div>

            <textarea
              ref="hiddenInput"
              v-model="userInput"
              class="hidden-input"
              @input="onInput"
              @keydown="onKeydown"
              @paste.prevent
              :maxlength="target.length"
              aria-label="Typing input"
            ></textarea>
          </div>

          <!-- TECLADO -->
          <div class="relative z-20 w-full">
            <Keyboard :nickname="user.nickname" :room="ROOM" />
          </div>
        </div>

        <!-- PANEL DERECHO: ESPECTADOR / NOTIFICACIONES -->
        <div class="lg:col-span-1 relative z-40">
          <div
            id="notification-panel"
            class="bg-black/40 border rounded-lg p-4 relative z-50"
            :class="{
              'border-purple-500': isPlayerDead,
              'border-lime-400/60': !isPlayerDead && serverMessages.length > 0,
              'border-gray-600/30':
                !isPlayerDead && serverMessages.length === 0,
            }"
            style="pointer-events: auto"
          >
            <!-- MODO ESPECTADOR: Cuando el jugador ha muerto -->
            <div v-if="isPlayerDead">
              <h3 class="text-purple-400 font-semibold text-lg mb-3">
                Has mort
              </h3>
              <p class="text-gray-300 mb-4">
                Vols continuar mirant la partida?
              </p>
              <div class="flex gap-2">
                <button
                  @click="continueAsSpectator"
                  class="flex-1 px-2 py-2 border border-lime-600 text-lime-400 rounded-md font-bold uppercase tracking-wider hover:bg-lime-600 hover:text-black transition text-xs cursor-pointer relative z-60"
                  style="pointer-events: auto"
                >
                  Sí
                </button>
                <button
                  @click="goToFinScreen"
                  class="flex-1 px-2 py-2 border border-purple-600 text-purple-400 rounded-md font-bold uppercase tracking-wider hover:bg-purple-600 hover:text-black transition text-xs cursor-pointer relative z-60"
                  style="pointer-events: auto"
                >
                  No
                </button>
              </div>
            </div>

            <!-- MODO NOTIFICACIONES: Cuando el jugador está vivo -->
            <div v-else>
              <h3
                class="text-lime-400 font-semibold text-sm mb-3 tracking-wider"
              >
                MISSATGES DEL SERVIDOR
              </h3>

              <!-- Lista de mensajes -->
              <div
                v-if="serverMessages.length > 0"
                class="space-y-2 max-h-32 overflow-y-auto"
              >
                <div
                  v-for="message in serverMessages"
                  :key="message.id"
                  class="text-xs p-2 rounded border-l-2 animate-fadeItem"
                  :class="{
                    'border-l-lime-400 bg-lime-400/10 text-lime-300':
                      message.type === 'info' || message.type === 'success',
                    'border-l-yellow-400 bg-yellow-400/10 text-yellow-300':
                      message.type === 'warning',
                    'border-l-purple-400 bg-purple-400/10 text-purple-300':
                      message.type === 'error',
                  }"
                >
                  {{ message.text }}
                </div>
              </div>

              <!-- Mensaje cuando no hay notificaciones -->
              <div v-else class="text-center text-gray-500 text-xs italic">
                Esperant missatges...
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ESPACIADO REDUCIDO -->
      <div class="h-2"></div>

      <!-- 3. PROGRESO DE LA CARRERA (COMPACTO Y DINÁMICO) -->
      <section
        v-if="raceState.length"
        class="bg-black/30 border border-lime-400/60 rounded-lg p-3 shadow-lg animate-fadeItem delay-[250ms] backdrop-blur-sm"
      >
        <h3 class="text-lime-400 font-semibold text-sm mb-2 tracking-wider">
          PROGRÉS DE LA CARRERA
        </h3>

        <div class="space-y-2">
          <div
            v-for="p in raceState"
            :key="p.nickname"
            class="flex items-center gap-2"
          >
            <span
              class="text-lime-300 font-medium text-xs min-w-[80px] truncate"
            >
              {{ p.nickname }}
            </span>

            <div
              class="flex-1 bg-gray-800/70 rounded-full h-2 overflow-hidden border border-gray-600/50"
            >
              <div
                class="bar h-full bg-gradient-to-r from-lime-400 to-lime-300 rounded-full transition-all duration-300 shadow-sm"
                :style="{ width: p.position * 1.5 + 'px' }"
              ></div>
            </div>

            <small
              class="text-gray-400 text-xs min-w-[30px] text-right font-mono"
            >
              {{ p.position }}
            </small>
          </div>
        </div>
      </section>

      <!-- FOOTER DE FRASE -->
      <!-- <footer
        class="relative z-20 text-center text-xs text-gray-500 italic mt-8 tracking-widest animate-fadeItem delay-[400ms]"
      >
        "Cada paraula conta... La supervivència depèn de la velocitat."
      </footer> -->
    </main>
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

import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";
import Keyboard from "@/components/Keyboard.vue";
const router = useRouter();
const user = useUserStore();

// Variables para la sala dinámica
const roomList = ref([]);
const currentRoom = ref(null);

// Variable global para controlar el panel de notificaciones/espectador
const isPlayerDead = ref(false);
const serverMessages = ref([]);

// Variables para el control dinámico del fondo
const isTyping = ref(false);
const backgroundSpeed = ref(0); // Velocidad actual del fondo (0 = parado, 1 = corriendo)
const lastTypingTime = ref(0);
const typingTimeout = ref(null);

// Función para actualizar la velocidad del fondo
function updateBackgroundSpeed() {
  const now = Date.now();
  const timeSinceLastTyping = now - lastTypingTime.value;

  // Sistema binario simple: parado o corriendo
  if (isTyping.value) {
    backgroundSpeed.value = 1; // Corriendo
  } else if (timeSinceLastTyping > 2000) {
    backgroundSpeed.value = 0; // Parado
  }

  // Aplicar la velocidad al fondo
  updateBackgroundAnimations(backgroundSpeed.value);
}

// Función para aplicar la velocidad a las animaciones
function updateBackgroundAnimations(speed = backgroundSpeed.value) {
  const layers = document.querySelectorAll(
    ".bg-layer-1, .bg-layer-2, .bg-layer-3, .bg-fog"
  );

  for (const layer of layers) {
    if (speed === 0) {
      layer.style.animationPlayState = "paused";
    } else {
      layer.style.animationPlayState = "running";
      // No cambiar animation-duration para evitar ralentizaciones
    }
  }
}

// Función para obtener la duración base de una capa
// Función para detectar actividad de escritura
function onTypingActivity() {
  isTyping.value = true;
  lastTypingTime.value = Date.now();

  // Limpiar timeout anterior
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value);
  }

  // Establecer que dejó de escribir después de 500ms de inactividad
  typingTimeout.value = setTimeout(() => {
    isTyping.value = false;
  }, 500);
}

// Función para agregar mensajes del servidor
function addServerMessage(message, type = "info") {
  const newMessage = {
    id: Date.now(),
    text: message,
    type: type, // info, warning, error, success
    timestamp: new Date(),
  };

  serverMessages.value.unshift(newMessage);

  // Mantener solo los últimos 3 mensajes
  if (serverMessages.value.length > 3) {
    serverMessages.value = serverMessages.value.slice(0, 3);
  }

  // Auto-eliminar mensaje después de 5 segundos
  setTimeout(() => {
    const index = serverMessages.value.findIndex(
      (msg) => msg.id === newMessage.id
    );
    if (index > -1) {
      serverMessages.value.splice(index, 1);
    }
  }, 5000);
}

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
  // Detectar actividad de escritura para el fondo dinámico
  onTypingActivity();

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

    setTimeout(() => {
      nextText();
    }, 300);
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

function continueAsSpectator() {
  console.log("Continuando como espectador...");
  addServerMessage("Mode espectador activat", "success");
  // Aquí puedes agregar lógica adicional para el modo espectador
  // Por ejemplo, deshabilitar el input de texto, cambiar el estado, etc.
}

function goToFinScreen() {
  console.log("Yendo a la pantalla de fin...");
  addServerMessage("Dirigint a resultats finals", "info");
  // Navegar a la pantalla de fin
  router.push({ name: "fin" });
}

// Función para simular muerte del jugador (para testing)
function simulatePlayerDeath() {
  isPlayerDead.value = true;
}

async function nextText() {
  await pickRandomText();
  reset();
}

// MOUNT
onMounted(async () => {
  // Inicializar el sistema de fondo dinámico con actualización suave y frecuente para máxima fluidez
  const backgroundUpdateInterval = setInterval(updateBackgroundSpeed, 50);

  // Limpiar el intervalo cuando el componente se desmonte
  onBeforeUnmount(() => {
    clearInterval(backgroundUpdateInterval);
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value);
    }
  });

  // Inicializar fondo parado
  updateBackgroundAnimations();

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

  addServerMessage("Connectat al servidor", "success");

  socket.on("userPerformance", (data) => {
    console.log("Notificación de rendimiento:", data);
    if (data.nickname !== user.nickname) {
      addServerMessage(data.message, "warning");
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

@keyframes backgroundMoveSlow {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: -100vw 0;
  }
}

@keyframes backgroundMoveMedium {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: -200vw 0;
  }
}

@keyframes backgroundMoveFast {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: -300vw 0;
  }
}

.bg-fog {
  background: url("/src/assets/nice-snow.png");
  background-repeat: repeat;
  background-size: 600px 600px;
  opacity: 0.3;
  filter: brightness(1.3) contrast(0.8);
  animation: fogMove 60s linear infinite paused;
  z-index: 7;
  pointer-events: none;
}

/* Capa 1: Fondo lejano (más lento) */
.bg-layer-1 {
  background-image: url("/src/assets/opt2_img1.png");
  background-repeat: repeat-x;
  background-size: width 1500px;
  background-position: 0 0;
  opacity: 0.8;
  animation: backgroundMoveSlow 60s linear infinite paused;
}

/* Capa 2: Fondo medio (velocidad media) */
.bg-layer-2 {
  background-image: url("/src/assets/opt1_img2.png");
  background-repeat: repeat-x;
  background-size: auto 100%;
  background-position: 0 0;
  opacity: 0.6;
  animation: backgroundMoveMedium 25s linear infinite paused;
}

/* Capa 3: Primer plano (más rápido, más cercano) */
.bg-layer-3 {
  background-image: url("/src/assets/opt1_img3.png");
  background-repeat: repeat-x;
  background-size: auto 100%;
  background-position: 0 0;
  opacity: 1;
  animation: backgroundMoveFast 15s linear infinite paused;
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
  line-height: 1.6;
  font-size: 0.9rem;
  min-height: 80px;
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
  /* background-color: rgba(16, 185, 129, 0.1); */
}

.wrong {
  color: #8f1de0; /* púrpura  */
  background-color: rgba(190, 164, 231, 0.15);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-shadow: 0 0 9px rgba(129, 30, 249, 0.6); /* leve glow sangriento */
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
