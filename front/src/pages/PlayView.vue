<template>
  <section
    class="relative min-h-screen flex flex-col items-center justify-start px-6 py-8 font-dogica text-gray-200 bg-gradient-to-b from-[#0B0C10] to-[#1F2833] overflow-hidden"
  >
    <!-- Fondo en capas con efecto paralaje -->
    <div class="absolute inset-0 overflow-hidden">
      <!-- Capa 1: Fondo lejano (más lento) -->
      <div class="absolute inset-0 bg-layer-1 z-0"></div>

      <!-- capa de niebla animada -->
      <div class="bg-fog absolute inset-0 z-7 pointer-events-none"></div>

      <!-- Capa 2: Fondo medio (velocidad media) -->
      <div class="absolute inset-0 bg-layer-2 z-5"></div>

      <!-- Capa oscura -->
      <div class="absolute inset-0 bg-black/40 z-[8]"></div>

      <!-- Capa 3: Primer plano (más rápido, más cercano al jugador) -->
      <div class="absolute inset-0 bg-layer-3 z-10"></div>
    </div>

    <!-- Contenido principal -->
    <main class="relative z-30 w-full max-w-6xl space-y-6 animate-fadeIn">
      <!-- Header con estadísticas -->
      <header
        class="flex flex-col lg:flex-row items-center justify-between gap-4 animate-fadeItem delay-[100ms]"
      >
        <h1
          class="text-3xl text-lime-400 font-bold drop-shadow-[0_0_15px_#66FCF1] text-center tracking-widest"
        >
          Escape the Monster
        </h1>

        <div class="flex flex-wrap gap-6 text-sm">
          <div class="text-center">
            <div class="text-lime-400 font-semibold">WPM</div>
            <div class="text-2xl text-lime-300">{{ wpm }}</div>
          </div>
          <div class="text-center">
            <div class="text-lime-400 font-semibold">Accuracy</div>
            <div class="text-2xl text-lime-300">{{ accuracy }}%</div>
          </div>
          <div class="text-center">
            <div class="text-lime-400 font-semibold">Time</div>
            <div class="text-2xl text-lime-300">{{ elapsedSeconds }}s</div>
          </div>
        </div>
      </header>

      <!-- Área de texto principal -->
      <section
        class="bg-black/70 border border-lime-400 rounded-lg p-6 shadow-lg animate-fadeItem delay-[200ms]"
        @click="focusInput"
      >
        <!-- Estados de carga y error -->
        <div v-if="loading" class="text-center py-12 text-lime-400">
          Cargando texto...
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
          <span v-if="!typingDisabled" class="caret" :style="caretStyle"></span>
        </div>

        <!-- hidden input to capture keyboard, mobile-friendly -->
        <textarea
          ref="hiddenInput"
          v-model="userInput"
          class="hidden-input"
          :disabled="typingDisabled"
          @input="onInput"
          @keydown="onKeydown"
          @paste.prevent
          :maxlength="target.length"
          aria-label="Typing input"
        ></textarea>
      </section>

      <!-- Pista de carrera con monstruito -->
      <section
        v-if="raceState.length"
        class="bg-black/40 border border-lime-400 rounded-lg p-4 shadow-lg animate-fadeItem delay-[300ms]"
      >
        <h3 class="text-lime-400 font-semibold text-lg mb-4">
          Escape the Monster!
        </h3>

        <div class="track-wrapper">
          <!-- lane -->
          <div class="track-lane">
            <!-- Finish flag -->
            <div class="finish-flag">🏁</div>

            <!-- Monster -->
            <div
              v-if="monsterState"
              class="runner monster"
              :style="runnerStyle(monsterState.position)"
            >
              <div class="runner-sprite monster-sprite">🧟‍♂️</div>
            </div>

            <!-- Players -->
            <div
              v-for="p in raceState"
              :key="p.nickname"
              class="runner"
              :class="{ dead: p.alive === false, me: p.nickname === user.nickname }"
              :style="runnerStyle(p.position)"
            >
              <div class="runner-sprite">
                <span v-if="p.alive">🏃‍♂️</span>
                <span v-else>💀</span>
              </div>
              <div class="runner-name">
                {{ p.nickname }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Jugadores en la sala -->
      <section
        v-if="participants.length > 0"
        class="bg-black/40 border border-lime-400 rounded-lg p-4 shadow-lg animate-fadeItem delay-[400ms]"
      >
        <h3 class="text-lime-400 font-semibold text-lg mb-4">
          Jugadores en la sala:
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="nick in participants"
            :key="nick"
            class="bg-gray-800/50 border border-gray-700 rounded-md p-3"
          >
            <div class="text-lime-300 font-semibold">{{ nick }}</div>
            <div class="text-sm text-gray-400">
              WPM: {{ findResult(nick)?.wpm ?? "-" }}
            </div>
            <div class="text-sm text-gray-400">
              Precisión: {{ findResult(nick)?.accuracy ?? "-" }}%
            </div>
          </div>
        </div>
      </section>

      <!-- Botones de control -->
      <footer
        class="flex flex-wrap justify-center gap-2 animate-fadeItem delay-[600ms]"
      >
        <button
          @click="resetAndHide"
          class="px-3 py-1 text-sm border border-lime-400 text-lime-400 rounded-md font-bold uppercase tracking-wider hover:bg-lime-400 hover:text-black transition"
        >
          Reset
        </button>
        <button
          @click="nextText"
          class="px-3 py-1 text-sm border border-sky-500 text-sky-400 rounded-md font-bold uppercase tracking-wider hover:bg-sky-500 hover:text-black transition"
        >
          Next Text
        </button>
        <button
          @click="goBackToLobby"
          class="px-3 py-1 text-sm border border-purple-600 text-purple-400 rounded-md font-bold uppercase tracking-wider hover:bg-purple-600 hover:text-black transition"
        >
          Back to Lobby
        </button>
      </footer>
    </main>

    <!-- Overlay de fin / muerte -->
    <div v-if="showOverlay" class="overlay">
      <div class="modal">
        <h3 v-if="dead">You were caught 💀</h3>
        <h3 v-else>Finished! 🏁</h3>

        <p><strong>WPM:</strong> {{ wpm }}</p>
        <p><strong>Accuracy:</strong> {{ accuracy }}%</p>
        <p><strong>Time:</strong> {{ elapsedSeconds }}s</p>

        <div class="modal-actions">
          <button class="btn" @click="goBackToLobby">Back to Lobby</button>
          <button class="btn" @click="keepWatching">Keep Watching</button>
        </div>
      </div>
    </div>

    <!-- resumen fijo en la esquina -->
    <aside v-if="gameResults.length" class="results-summary">
      <h4 class="summary-title">Race Results</h4>

      <div
        v-for="r in gameResults"
        :key="r.nickname"
        class="summary-item"
        :class="{ me: r.nickname === user.nickname }"
      >
        <div class="summary-row">
          <strong>{{ r.nickname }}</strong>
          <span v-if="r.nickname === user.nickname" class="you-tag">(You)</span>
        </div>
        <div class="summary-stats">
          <span>🏁 {{ r.wpm }} WPM</span>
          <span>🎯 {{ r.accuracy }}%</span>
        </div>
        <small v-if="r.state === 'dead'">💀 Eliminated</small>
        <small v-else>🏁 Finished</small>
      </div>
    </aside>

    <!-- Teclado -->
    <div class="relative z-20 w-full max-w-6xl mt-4 animate-fadeItem delay-[700ms]">
      <Keyboard :nickname="user.nickname" :room="ROOM" />
    </div>

    <!-- Footer -->
    <footer
      class="relative z-20 text-center text-xs text-gray-500 italic mt-4 tracking-widest animate-fadeItem delay-[800ms]"
    >
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
import { socket } from "@/services/socket.js";
import { useToast } from "vue-toastification";
import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";
import Keyboard from "@/components/Keyboard.vue";

const router = useRouter();
const user = useUserStore();
const toast = useToast();

if (!user.hasNick) {
  router.replace({ name: "home", query: { needNick: "1" } });
}

// ----- ROOM dinámico -----
const roomList = ref([]);
const currentRoom = ref(null);

const ROOM = computed(() => {
  if (currentRoom.value) return currentRoom.value.name;
  if (!Array.isArray(roomList.value)) return "";

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

// ----- DATA LOADING -----
const current = ref(null);
const target = ref("");
const loading = ref(true);
const error = ref(null);

const gameResults = ref([]);
const participants = ref([]); // nicks de los jugadores
const targetChars = computed(() => Array.from(target.value));

// RACE STATE (from server)
const raceState = ref([]);
const monsterState = ref(null);
const trackLen = ref(100);

socket.on("race:update", (snap) => {
  if (Array.isArray(snap)) {
    raceState.value = snap;
    monsterState.value = null;
    trackLen.value = 100;
  } else {
    raceState.value = snap.players || [];
    monsterState.value = snap.monster || null;
    trackLen.value = snap.trackLen || 100;
    console.log("🏁 Race update received:", {
      players: raceState.value.length,
      monster: monsterState.value,
    });
  }
});

function cleanStat(n, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(max, Math.round(v)));
}

function pushResultUnique(entry) {
  const cleaned = {
    ...entry,
    wpm: cleanStat(entry.wpm, 400),
    accuracy: cleanStat(entry.accuracy, 100),
  };

  const i = gameResults.value.findIndex((r) => r.nickname === cleaned.nickname);
  if (i === -1) {
    gameResults.value.push(cleaned);
  } else {
    gameResults.value[i] = { ...gameResults.value[i], ...cleaned };
  }
}

// player reached TRACK_LEN (server)
socket.on("player:finished", ({ nickname, wpm, accuracy }) => {
  pushResultUnique({ nickname, wpm, accuracy, state: "finished" });

  if (nickname === user.nickname) {
    endedAt.value = endedAt.value || Date.now();
    showOverlay.value = true;
    reachedFinish.value = true;
  }
});

// player got caught by monster
socket.on("player:caught", ({ nickname, wpm, accuracy }) => {
  pushResultUnique({ nickname, wpm, accuracy, state: "dead" });

  if (nickname === user.nickname) {
    dead.value = true;
    endedAt.value = endedAt.value || Date.now();
    showOverlay.value = true;
    hiddenInput.value?.blur();
  }
});

// race over info (already handled above for UI)
socket.on("race:over", ({ winner }) => {
  console.log(`🏁 Race over! Winner: ${winner ?? "none"}`);
});

// errores y rendimiento
const totalErrors = ref(0);
const lastTypedLength = ref(0);
const lastWpmEmit = ref(0); // reservado para mejoras futuras

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

// ----- TYPING STATE -----
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
const minutes = computed(() => {
  if (elapsedMs.value <= 0) return 0;
  return elapsedMs.value / 60000;
});

const wpm = computed(() => {
  const mins = minutes.value;
  if (mins <= 0) return 0;
  const words = correctChars.value / 5;
  return Math.round(words / mins);
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

function resetAndHide() {
  showOverlay.value = false;
  dead.value = false;
  reset();
}

function goBackToLobby() {
  router.push("/lobby");
}

function keepWatching() {
  showOverlay.value = false;
  dead.value = true; // spectator
  hiddenInput.value?.blur();
}

const prevCorrect = ref(0);
const dead = ref(false);
const showOverlay = ref(false);
const reachedFinish = ref(false);

// typing should only be disabled when you're dead, finished race, or overlay open
const typingDisabled = computed(
  () => dead.value || reachedFinish.value || showOverlay.value
);

// INPUT HANDLERS
async function onInput() {
  if (dead.value || reachedFinish.value) return;

  if (!startedAt.value && userInput.value.length > 0) {
    startedAt.value = Date.now();
  }

  if (userInput.value.length > target.value.length) {
    userInput.value = userInput.value.slice(0, target.value.length);
  }

  // ---- error tracking ----
  const len = userInput.value.length;
  const diff = len - lastTypedLength.value;

  if (diff > 0) {
    for (let i = lastTypedLength.value; i < len; i++) {
      if (userInput.value[i] !== target.value[i]) {
        totalErrors.value++;
        console.log("Nuevo error acumulado:", totalErrors.value);
      }
    }
  }
  lastTypedLength.value = len;

  if (totalErrors.value > 0 && totalErrors.value % 5 === 0) {
    socket.emit("userPerformance", {
      room: ROOM.value,
      nickname: user.nickname,
      status: "bad",
      message: `${user.nickname} está teniendo dificultades (${totalErrors.value} errores).`,
    });
  }

  // ---- race speed bump per correct char ----
  const was = prevCorrect.value;
  const now = correctChars.value;
  const correctChar = now > was;
  prevCorrect.value = now;

  socket.emit("typing:progress", {
    room: ROOM.value,
    nickname: user.nickname,
    correctChar,
    wpm: wpm.value,
    accuracy: accuracy.value,
  });

  // ---- texto infinito: cuando terminas el texto, cargar el siguiente ----
  if (userInput.value.length >= target.value.length) {
    await nextText();
    userInput.value = "";
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
  reachedFinish.value = false;
  prevCorrect.value = 0;
  totalErrors.value = 0;
  lastTypedLength.value = 0;
  focusInput();
}

async function nextText() {
  showOverlay.value = false;
  dead.value = false;
  await pickRandomText();
  reset();
}

// MOUNT
onMounted(async () => {
  // pedir lista de salas (para saber en qué ROOM estamos)
  socket.emit("requestRoomList");

  socket.on("roomList", (data) => {
    roomList.value = Array.isArray(data.rooms) ? data.rooms : [];
    if (!currentRoom.value) {
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
    }
  });

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

  socket.on("updateUserList", (list) => {
    participants.value = (list || []).map((p) =>
      typeof p === "string" ? p : p.nickname ?? p.name ?? String(p)
    );
    console.log("Lista de usuarios actualizada:", participants.value);
  });

  await pickRandomText();
  await nextTick();

  if (!target.value) {
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
  socket.off("race:update");
  socket.off("player:finished");
  socket.off("player:caught");
  socket.off("race:over");
  socket.off("updateGameResults");
  socket.off("userPerformance");
  socket.off("updateUserList");
  socket.off("roomList");
});

// blur input when overlay shown
watch(showOverlay, (v) => {
  if (v) hiddenInput.value?.blur();
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

// Debug ROOM changes
watch(ROOM, (newRoom) => {
  if (newRoom) {
    console.log("📍 Current room:", newRoom);
  }
});

// utility para buscar resultado por nickname
function findResult(nick) {
  return gameResults.value.find((r) => r.nickname === nick);
}

// estilo inline para runners (monster y jugadores)
function runnerStyle(position) {
  const len = trackLen.value || 100;
  const clamped = Math.max(0, Math.min(position, len));
  const pct = (clamped / len) * 100;
  return {
    left: pct + "%",
  };
}
</script>

<style scoped>
/* ----- HUD de resultados flotante ----- */
.results-summary {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid #4b5563;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  padding: 0.75rem 0.85rem;
  width: 240px;
  max-height: 350px;
  overflow-y: auto;
  font-size: 0.85rem;
  z-index: 40;
  transition: all 0.3s ease;
}

.summary-title {
  font-weight: 600;
  font-size: 0.9rem;
  text-align: center;
  margin-bottom: 0.4rem;
  color: #e5e7eb;
}

.summary-item {
  background: rgba(15, 23, 42, 0.9);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  margin-bottom: 0.35rem;
  border: 1px solid #374151;
  display: flex;
  flex-direction: column;
  transition: background 0.3s, transform 0.2s;
}

.summary-item:last-child {
  margin-bottom: 0;
}

.summary-item.me {
  border-color: #a3e635;
  background: rgba(34, 197, 94, 0.1);
  transform: scale(1.02);
  box-shadow: 0 0 0 1px rgba(163, 230, 53, 0.5);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.you-tag {
  font-size: 0.75rem;
  color: #a3e635;
}

.summary-stats {
  display: flex;
  justify-content: space-between;
  color: #e5e7eb;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.summary-item strong {
  color: #f9fafb;
}

/* ----- Overlay / modal ----- */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  animation: fadeInOverlay 0.25s ease;
}

.modal {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  min-width: 260px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  animation: popIn 0.2s ease;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.75rem;
}

.btn {
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: white;
  cursor: pointer;
}

.btn:hover {
  background: #f3f4f6;
}

/* ----- Animaciones de fondo ----- */
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
  animation: fogMove 60s linear infinite;
  z-index: 7;
  pointer-events: none;
}

/* Capa 1: Fondo lejano (más lento) */
.bg-layer-1 {
  background-image: url("/src/assets/opt2_img1.png");
  background-repeat: repeat-x;
  background-size: auto 100%;
  background-position: 0 0;
  opacity: 0.8;
  animation: backgroundMoveSlow 60s linear infinite;
}

/* Capa 2: Fondo medio (velocidad media) */
.bg-layer-2 {
  background-image: url("/src/assets/opt1_img2.png");
  background-repeat: repeat-x;
  background-size: auto 100%;
  background-position: 0 0;
  opacity: 0.6;
  animation: backgroundMoveMedium 25s linear infinite;
}

/* Capa 3: Primer plano (más rápido, más cercano) */
.bg-layer-3 {
  background-image: url("/src/assets/opt1_img3.png");
  background-repeat: repeat-x;
  background-size: auto 100%;
  background-position: 0 0;
  opacity: 1;
  animation: backgroundMoveFast 15s linear infinite;
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

@keyframes fadeInOverlay {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes popIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
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

/* characters */
.char {
  position: relative;
}
.untouched {
  opacity: 0.6;
  color: #6b7280;
}
.correct {
  color: #a3e635;
}
.wrong {
  color: #8f1de0;
  background-color: rgba(190, 164, 231, 0.15);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-shadow: 0 0 9px rgba(129, 30, 249, 0.6);
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

/* ----- Pista de carrera ----- */
.race-track {
  margin-top: 1.5rem;
}

.track-wrapper {
  position: relative;
  border-radius: 4px;
  border: 1px solid #4b5563;
  background: radial-gradient(circle at 0 0, #111827, #020617);
  padding: 14px 18px;
}

.track-lane {
  position: relative;
  height: 72px;
}

/* Finish flag at far right */
.finish-flag {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.25rem;
}

/* Each runner (monster + players) */
.runner {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: transform 0.1s linear, left 0.1s linear;
}

.runner.me .runner-sprite {
  box-shadow: 0 0 0 2px #60a5fa;
}

.runner.dead {
  opacity: 0.5;
}

/* The avatar circle */
.runner-sprite {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: #020617;
  border: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Special monster skin */
.monster-sprite {
  background: #7f1d1d;
  border-color: #fecaca;
}

/* name label under avatar */
.runner-name {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.8);
  color: #e5e7eb;
}
</style>