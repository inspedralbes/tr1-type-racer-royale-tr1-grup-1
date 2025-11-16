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
          Escapa dels atacants!
        </h1>

        <div class="flex flex-wrap gap-6 text-sm">
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
        class="grid grid-cols-1 lg:grid-cols-8 gap-6 animate-fadeItem delay-[200ms]"
      >
        <!-- SIDEBAR IZQUIERDO: INFO DE SALA Y POSICIONES -->
        <div class="lg:col-span-2 space-y-4">
          <!-- INFO DE LA SALA -->
          <div class="bg-black/40 border border-gray-500/60 rounded-lg p-3">
            <h3 class="text-lime-300 font-semibold text-sm mb-2">
              Informació del panteó
            </h3>
            <p class="text-xs">
              <span class="text-white">Panteó:</span>
              <span class="text-gray-300">{{ ROOM }}</span>
            </p>
            <p class="text-xs">
              <span class="text-white">Usuari:</span>
              <span class="text-gray-300">{{ user.nickname }}</span>
            </p>
            <p class="text-xs">
              <span class="text-white">Nº zombies:</span>
              <span class="text-gray-300">{{ participants.length }}</span>
            </p>
          </div>

          <!-- POSICIONES EN TIEMPO REAL -->
          <div class="bg-black/40 border border-gray-500/60 rounded-lg p-3">
            <h3 class="text-lime-300 font-semibold text-sm mb-2">
              Puntuacions
            </h3>
            <div class="space-y-1">
              <div
                v-for="p in [...raceState].sort(
                  (a, b) => b.position - a.position
                )"
                :key="p.nickname"
                class="flex justify-between text-xs"
                :class="{
                  'opacity-40': p.isAlive === false,
                }"
              >
                <template v-if="p.nickname === user.nickname">
                  <span
                    class="text-purple-600"
                    :class="{ 'line-through': p.isAlive === false }"
                    >{{ user.nickname }} (Tú)</span
                  >
                  <span class="text-purple-600">{{ p.position }}</span>
                </template>
                <template v-else>
                  <span
                    class="text-gray-300"
                    :class="{ 'line-through': p.isAlive === false }"
                    >{{ p.nickname }}</span
                  >
                  <span class="text-gray-400">{{ p.position }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- ÁREA CENTRAL: TEXTO Y TECLADO -->
        <div class="lg:col-span-5 space-y-4">
          <!-- ÁREA DE TEXTO A ESCRIBIR -->
          <div
            class="bg-black/70 border border-lime-400 rounded-lg p-3 shadow-lg transition-opacity duration-500"
            :class="{ 'opacity-30 pointer-events-none': isPlayerDead }"
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
              <span
                v-if="!finished && !isPlayerDead"
                class="caret"
                :style="caretStyle"
              ></span>
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
          <div
            class="relative z-20 w-full transition-opacity duration-500"
            :class="{ 'opacity-50': isPlayerDead }"
          >
            <Keyboard :nickname="user.nickname" :room="ROOM" />
          </div>
        </div>

        <!-- PANEL DERECHO: ESPECTADOR / NOTIFICACIONES -->
        <div class="lg:col-span-1 relative z-40">
          <div
            id="notification-panel"
            class="bg-black/40 border rounded-lg p-3 relative z-50 h-fit min-w-0"
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
              <h3 class="text-purple-400 font-semibold text-sm mb-2">
                Has mort!
              </h3>
              <p class="text-gray-300 mb-2" style="font-size: 0.65rem">
                Mode espectador activat
              </p>
              <div class="text-purple-300 italic" style="font-size: 0.65rem">
                Continua mirant la partida...
              </div>
            </div>

            <!-- MODO NOTIFICACIONES: Cuando el jugador está vivo -->
            <div v-else>
              <h3
                class="text-lime-400 font-semibold text-xs mb-2 tracking-wider"
              >
                VEUS DEL PANTEÓ
              </h3>

              <!-- Lista de mensajes -->
              <div
                v-if="serverMessages.length > 0"
                class="space-y-1 max-h-24 overflow-y-auto"
              >
                <div
                  v-for="message in serverMessages"
                  :key="message.id"
                  class="text-xs p-1 rounded border-l-2 animate-fadeItem"
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
              <div
                v-else
                class="text-center text-gray-500 italic leading-tight px-1"
                style="font-size: 0.55rem"
              >
                Esperant missatges...
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ESPACIADO REDUCIDO -->
      <div class="h-1"></div>

      <!-- 3. PROGRESO DE LA CARRERA -->
      <section
        v-if="raceState.length"
        class="bg-neutral-900/60 border border-lime-400/40 rounded-xl p-4 shadow-xl backdrop-blur-sm"
      >
        <h3
          class="text-lime-400 font-semibold text-sm mb-3 flex items-center gap-2"
        >
          No deixis que t'atrapin. Escriu!
        </h3>

        <div class="space-y-4">
          <div
            v-for="(p, i) in sortedRaceState"
            :key="p.nickname"
            class="relative flex items-center gap-3 p-2 rounded-lg bg-black/20 transition-opacity duration-300"
            :class="{
              'opacity-30': p.isAlive === false,
            }"
          >
            <!-- Nombre -->
            <span
              class="text-lime-300 font-semibold text-xs w-24 truncate"
              :class="{
                'line-through text-red-400': p.isAlive === false,
              }"
            >
              {{ p.nickname }}
            </span>

            <!-- Pista -->
            <div
              class="relative flex-1 h-12 bg-neutral-800/50 rounded-xl border border-neutral-700 overflow-hidden"
            >
              <!-- Línea de meta -->
              <div
                class="absolute right-0 top-0 h-full w-2 bg-gradient-to-b from-lime-200 to-lime-400 animate-pulse"
              ></div>

              <!-- ZOMBIE PIXEL ART ANIMADO -->
              <div
                class="zombie-sprite absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
                :class="{
                  'grayscale opacity-50': p.isAlive === false,
                }"
                :style="{ left: p.position * 1.3 + 'px' }"
              ></div>
            </div>

            <!-- Indica el último (va a morir) -->
            <span
              :class="[
                'text-xs font-mono px-2 py-0.5 rounded-md transition-colors duration-300',
                p.position === Math.min(...raceState.map((r) => r.position)) &&
                p.isAlive !== false
                  ? 'bg-red-600/40 text-red-200 animate-pulse'
                  : 'text-gray-300',
                p.isAlive === false ? 'line-through' : '',
              ]"
            >
              {{ p.position }}
            </span>
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
import Swal from "sweetalert2";
const router = useRouter();
const user = useUserStore();

// Variables para la sala dinámica
const roomList = ref([]);
const currentRoom = ref(null);

// Variable global para controlar el panel de notificaciones/espectador
const isPlayerDead = ref(false);
const serverMessages = ref([]);
const deathAlertShown = ref(false); // Bandera para controlar que el alert de muerte solo se muestre una vez

// Variable para forzar la actualización del tiempo
const currentTime = ref(Date.now());

// Variables para el control dinámico del fondo
const isTyping = ref(false);
const backgroundSpeed = ref(0); // Velocidad actual del fondo (0 = parado, 1 = corriendo)
const lastTypingTime = ref(0);
const typingTimeout = ref(null);

// Set para rastrear jugadores ya procesados como muertos
const processedDeaths = ref(new Set());

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
const currentTextId = ref(0);
const textsIds = ref([]); // IDs de textos asignados al usuario

// RACE STATE (from server)
const raceState = ref([]);

// Función para llenar participants con datos de jugadores
function loadParticipants(playersList) {
  if (playersList && Array.isArray(playersList)) {
    participants.value = playersList.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      color: player.color,
      wpm: player.wpm || 0,
      accuracy: player.accuracy || 0,
      isAlive: player.isAlive !== false, // Asegurar que isAlive se sincronice (default true)
      textsIds: player.textsIds || [],
    }));
    console.log("✓ Participantes sincronizados:", participants.value);
  }
}
socket.on("race:update", (snapshot) => {
  raceState.value = snapshot || [];
});

// Detectar si alguien llega a 700 de posición para terminar la carrera
watch(
  () => raceState.value,
  (newState) => {
    if (newState && newState.length > 0) {
      const maxPosition = Math.max(...newState.map((p) => p.position));
      if (maxPosition >= 700) {
        console.log("¡Alguien llegó a 700! Enviando endRaceInRoom al servidor");
        socket.emit("endRace", { room: ROOM.value, nickname: user.nickname });
      }
    }
  },
  { deep: true }
);

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
  // Usar currentTime.value para hacer reactivo el tiempo
  const end = endedAt.value ?? currentTime.value;
  return Math.max(0, end - startedAt.value);
});
const elapsedSeconds = computed(() => Math.floor(elapsedMs.value / 1000));
const minutes = computed(() => (elapsedMs.value || 1) / 60000);
// const wpm = computed(() => {
//   const words = correctChars.value / 5;
//   return Math.max(0, Math.round(words / minutes.value));
// });
const accuracy = computed(() => {
  if (typedChars.value === 0) return 100;
  return Math.round((correctChars.value / typedChars.value) * 100);
});

// Computed para ordenar el estado de la carrera con el jugador actual primero
const sortedRaceState = computed(() => {
  if (!raceState.value || raceState.value.length === 0) return [];

  const result = [];
  let currentPlayer = null;
  const otherPlayers = [];

  // Buscar al jugador actual y separar a los demás
  for (let i = 0; i < raceState.value.length; i++) {
    if (raceState.value[i].nickname === user.nickname) {
      currentPlayer = raceState.value[i];
    } else {
      otherPlayers.push(raceState.value[i]);
    }
  }

  // Ordenar otros jugadores por posición (de mayor a menor)
  for (let i = 0; i < otherPlayers.length - 1; i++) {
    for (let j = 0; j < otherPlayers.length - 1 - i; j++) {
      if (otherPlayers[j].position < otherPlayers[j + 1].position) {
        // Intercambiar posiciones
        const temp = otherPlayers[j];
        otherPlayers[j] = otherPlayers[j + 1];
        otherPlayers[j + 1] = temp;
      }
    }
  }

  // Poner al jugador actual primero
  if (currentPlayer) {
    result.push(currentPlayer);
  }

  // Agregar los demás jugadores
  for (let i = 0; i < otherPlayers.length; i++) {
    result.push(otherPlayers[i]);
  }

  return result;
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

// Track previous input length to detect backspace
let previousInputLength = 0;

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
      message: `${user.nickname} .`,
    });
  }

  // Solo emitir progreso si se escribieron caracteres nuevos (NO en backspace)
  if (userInput.value.length > previousInputLength) {
    emitProgressThrottled();
  }

  // Actualizar la longitud anterior para detectar backspace
  previousInputLength = userInput.value.length;

  if (finished.value && !endedAt.value) {
    if (currentTextId.value === 4) {
      // Solo detener el tiempo cuando termine todos los textos
      endedAt.value = Date.now();
      console.log("Juego finalizado para el usuario:", user.nickname);
      socket.emit("endRace", { room: ROOM.value, nickname: user.nickname });
    } else {
      setTimeout(() => {
        nextText(currentTextId.value);
      }, 300);
    }
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
  // NO reiniciar startedAt ni endedAt entre textos
  // startedAt.value = null;
  // endedAt.value = null;
  totalErrors.value = 0; // resetear errores
  lastTypedLength.value = 0;
  focusInput();
}

// Función para simular muerte del jugador (para testing)
function simulatePlayerDeath() {
  isPlayerDead.value = true;
}

async function nextText(posicion) {
  console.log("Cargando texto con ID:", textsIds.value[posicion]);

  if (!textsIds.value || posicion >= textsIds.value.length) {
    console.error("No hay más textos disponibles o textsIds está vacío");
    error.value = "No hay más textos disponibles";
    return;
  }

  try {
    loading.value = true;
    const data = await getText(textsIds.value[posicion]);
    const text = data.text ?? data.TEXT_CONTENT ?? data.TEXT;
    current.value = data;
    target.value = text ?? "";
    currentTextId.value++;
    reset();
    loading.value = false;
  } catch (err) {
    console.error("Error cargando texto:", err);
    error.value = "Error al cargar el texto";
    loading.value = false;
  }
}

function getTextIds() {
  for (let i = 0; i < participants.value.length; i++) {
    if (participants.value[i].nickname === user.nickname) {
      textsIds.value = participants.value[i].textsIds || [];
      console.log("Text IDs del usuario:", textsIds.value);
      return textsIds.value;
    }
  }
  console.warn("No se encontraron textsIds para el usuario:", user.nickname);
  return [];
}

// MOUNT
onMounted(async () => {
  // Inicializar el sistema de fondo dinámico con actualización suave y frecuente para máxima fluidez
  const backgroundUpdateInterval = setInterval(updateBackgroundSpeed, 50);

  // Intervalo para actualizar el tiempo cada segundo
  const timeUpdateInterval = setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);

  // Limpiar el intervalo cuando el componente se desmonte
  onBeforeUnmount(() => {
    clearInterval(backgroundUpdateInterval);
    clearInterval(timeUpdateInterval);
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

    // Cargar los datos de los participantes (pasar solo el array de players)
    if (userRoom && userRoom.players) {
      loadParticipants(userRoom.players);
      getTextIds(); // Obtener los textosIds del usuario
    }

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

  // Carregar Final de la carrera
  socket.on("endRaceInRoom", () => {
    // Calcular WPM correctamente
    const wpmValue = getWpm();

    // Obtener la posición actual del jugador
    const playerPosition =
      raceState.value.find((p) => p.nickname === user.nickname)?.position || 0;

    // Enviar resultados al servidor con todos los datos
    socket.emit("gameFinished", {
      room: ROOM.value,
      nickname: user.nickname,
      wpm: wpmValue,
      accuracy: accuracy.value,
      errors: totalErrors.value,
      position: playerPosition,
    });
    console.log("La carrera ha terminado");
    router.push({ name: "fin" });
  });

  function getWpm() {
    const words = correctChars.value / 5;
    return Math.max(0, Math.round(words / minutes.value));
  }

  addServerMessage("Connectat al servidor", "success");

  socket.on("userPerformance", (data) => {
    console.log("Notificación de rendimiento:", data);
    if (data.nickname !== user.nickname) {
      addServerMessage(data.message, "warning");
    }
  });

  // Escuchar lista de usuarios en la sala
  socket.on("updateUserList", (list) => {
    loadParticipants(list);
    getTextIds(); // Actualizar textsIds cuando se actualiza la lista de usuarios
  });

  // Matar jugador
  // Auto-kill every 15s: encuentra al jugador con menor posición y avisa al servidor
  let lastKilledNickname = null; // Track the last killed player to avoid killing the same player multiple times

  const autoKillInterval = setInterval(() => {
    if (!raceState.value || raceState.value.length === 0) return;

    // Filtrar solo jugadores vivos
    const alivePlayers = raceState.value.filter((p) =>
      typeof p.isAlive === "undefined" ? true : p.isAlive
    );

    if (alivePlayers.length === 0) return;

    // Calcular la posición mínima entre los vivos
    const minPos = Math.min(...alivePlayers.map((p) => p.position));

    // Elegir el primer jugador con esa posición mínima que aún esté vivo
    // y que no sea el que fue eliminado en la ronda anterior
    const victim = alivePlayers.find(
      (p) => p.position === minPos && p.nickname !== lastKilledNickname
    );

    if (victim) {
      console.log(
        "Auto-kill: matando a",
        victim.nickname,
        "con posición",
        minPos,
        "en sala",
        ROOM.value
      );

      lastKilledNickname = victim.nickname;

      socket.emit("player:isDeath", {
        roomName: ROOM.value,
        nickname: victim.nickname,
      });
    }
  }, 30000);

  socket.on("player:dead", (data) => {
    console.log("Jugador muerto recibido:", data);
    const roomName = data.roomName || ROOM.value;

    // Evitar procesar el mismo jugador múltiples veces
    if (processedDeaths.value.has(data.nickname)) {
      console.log(
        `Muerte de ${data.nickname} ya fue procesada, ignorando duplicado`
      );
      return;
    }

    // Marcar este jugador como ya procesado
    processedDeaths.value.add(data.nickname);

    // Reproducir sonido de muerte
    const deathSound = new Audio("/src/assets/shoot.mp3");
    deathSound.volume = 0.7;
    deathSound
      .play()
      .catch((err) => console.log("Error reproduciendo sonido:", err));

    if (data.nickname === user.nickname) {
      // Marcar al jugador actual como muerto (UI local)
      isPlayerDead.value = true;

      addServerMessage("Has mort!", "error");

      // Solo mostrar el SweetAlert una vez
      if (!deathAlertShown.value) {
        deathAlertShown.value = true;
        Swal.fire({
          title: "Has mort!",
          text: "Estarà en mode espectador.",
          icon: "error",
          showConfirmButton: false,
          timer: 5000,
        });
      }

      // Deshabilitar el input oculto para que no pueda seguir escribiendo
      if (hiddenInput.value) {
        hiddenInput.value.disabled = true;
        hiddenInput.value.blur();
      }
    } else {
      addServerMessage(`${data.nickname} ha mort!`, "warning");
    }

    // Verificar después de 2 segundos usando participants.value (que está sincronizado con updateUserList)
    setTimeout(() => {
      if (participants.value && participants.value.length > 0) {
        // Contar cuántos jugadores están vivos según participants.value
        const playersAlive = participants.value.filter(
          (p) => p.isAlive !== false
        ).length;

        console.log(
          `Jugadores vivos en sala ${roomName}: ${playersAlive} de ${participants.value.length}`
        );

        // Si solo queda una persona viva, terminar la partida
        if (playersAlive === 1) {
          console.log("¡Solo queda un jugador vivo! Terminando la partida.");

          const lastPlayer = participants.value.find(
            (p) => p.isAlive !== false
          );

          if (lastPlayer && lastPlayer.nickname === user.nickname) {
            // Si el último jugador vivo es el usuario actual, mostrar alerta de victoria
            Swal.fire({
              title: "Felicitats!",
              text: "Has guanyat!",
              icon: "success",
              showConfirmButton: false,
              timer: 5000,
            }).then(() => {
              socket.emit("endRace", {
                room: ROOM.value,
                nickname: user.nickname,
              });
            });
          }
        }
      } else {
        console.warn("No hay participantes para verificar jugadores vivos");
      }
    }, 2000);
  });

  // Obtener textos inicialmente si ya tenemos participantes
  if (participants.value.length > 0) {
    getTextIds();
  }

  if (textsIds.value.length > 0) {
    await nextText(currentTextId.value);
  } else {
    // Esperar a que se carguen los textsIds
    let retries = 0;
    const waitForTexts = setInterval(async () => {
      retries++;
      if (textsIds.value.length > 0) {
        clearInterval(waitForTexts);
        await nextText(currentTextId.value);
      } else if (retries > 20) {
        clearInterval(waitForTexts);
        error.value = "No se pudieron cargar los textos asignados";
        loading.value = false;
      }
    }, 200);
  }

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
  socket.off("player:dead");
  socket.off("updateUserList");
  socket.off("endRaceInRoom");
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
  font-size: 1rem;
  min-height: 60px;
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
  color: #8f1de0;
  /* púrpura  */
  background-color: rgba(190, 164, 231, 0.15);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-shadow: 0 0 9px rgba(129, 30, 249, 0.6);
  /* leve glow sangriento */
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

.zombie-sprite {
  width: 48px;
  height: 48px;
  background-image: url("../assets/zombie_run.png");
  background-repeat: no-repeat;
  /* background-size = total width / total height para encajar todo en un frame visible */
  background-size: calc(48px * 3) calc(48px * 2);
  /* 3 columnas × 2 filas, escalado a 48px cada frame */
  animation: zombie-run 0.6s steps(2) infinite;
}

@keyframes zombie-run {
  from {
    background-position: 0 0;
  }

  to {
    background-position: -96px 0;
  }

  /* 48 * 2 = 96px (solo los 2 primeros frames que se ven bien) */
}
</style>
