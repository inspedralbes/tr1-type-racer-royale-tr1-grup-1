<template>
  <main class="typing-page">
    <header class="topbar">
      <h1>Typing Test</h1>
      <div class="stats">
        <div><strong>WPM:</strong> {{ wpm }}</div>
        <div><strong>Accuracy:</strong> {{ accuracy }}%</div>
        <div><strong>Time:</strong> {{ elapsedSeconds }}s</div>
      </div>
    </header>

    <section class="text-area" @click="focusInput">
      <!-- Estados de carga y error -->
      <div v-if="loading" class="status-message loading">Cargando texto...</div>
      <div v-else-if="error" class="status-message error">{{ error }}</div>

      <!-- Contenido del texto -->
      <div v-else class="text-wrapper" ref="textWrapper">
        <span
          v-for="(ch, i) in targetChars"
          :key="i"
          :class="charClass(i)"
        >{{ ch }}</span>
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

    <!-- Jugadores de la sala -->
    <section v-if="participants.length > 0" class="participants-section">
      <h3>Jugadores en la sala:</h3>
      <div class="results-grid">
        <div
          v-for="nick in participants"
          :key="nick"
          class="result-card"
        >
          <strong>{{ nick }}</strong>
          <div>WPM: {{ findResult(nick)?.wpm ?? "-" }}</div>
          <div>Precisión: {{ findResult(nick)?.accuracy ?? "-" }}%</div>
        </div>
      </div>
    </section>

    <!-- Race progress (server-authoritative) -->
    <section v-if="raceState.length > 0 || monsterState" class="race-progress">
      <h3>Race progress</h3>

      <!-- Monster -->
      <div v-if="monsterState" class="progress-row">
        <span>🧟 Monster</span>
        <div class="bar-container">
          <div
            class="bar monster"
            :style="{ width: pct(monsterState.position) }"
          ></div>
        </div>
        <small>{{ (monsterState.position / trackLen * 100).toFixed(0) }}%</small>
      </div>

      <!-- Players -->
      <div v-for="p in raceState" :key="p.nickname" class="progress-row">
        <span :class="{ dead: p.alive === false }">{{ p.nickname }}</span>
        <div class="bar-container">
          <div
            class="bar"
            :class="{ dead: p.alive === false }"
            :style="{ width: pct(p.position) }"
          />
        </div>
        <small>{{ (p.position / trackLen * 100).toFixed(0) }}%</small>
      </div>
    </section>

    <!-- Finish/Death overlay -->
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

    <footer class="actions">
      <button class="btn" @click="resetAndHide">Reset</button>
      <button class="btn" @click="nextText">Next Text</button>
    </footer>

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

    <!-- teclado bonito de la rama dev -->
    <Keyboard :nickname="user.nickname" :room="ROOM" />
  </main>
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

// ----- ROOM dinámico (rama dev) -----
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
    console.log("🏁 Race update received:", { players: raceState.value.length, monster: monsterState.value });
  }
});

function pct(pos) {
  const len = trackLen.value || 100;
  const clamped = Math.max(0, Math.min(pos, len));
  return ((clamped / len) * 100).toFixed(1) + "%";
}

function cleanStat(n, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(max, Math.round(v)));
}

function pushResultUnique(entry) {
  const cleaned = {
    ...entry,
    wpm: cleanStat(entry.wpm, 400),        // cap at 400 WPM
    accuracy: cleanStat(entry.accuracy, 100),
  };

  const i = gameResults.value.findIndex(r => r.nickname === cleaned.nickname);
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

// global race over (all resolved)
socket.on("race:over", ({ winner }) => {
  console.log(`🏁 Race over! Winner: ${winner ?? "none"}`);
  // We already handle overlay for winner/loser via player:finished / player:caught
});

// errores y rendimiento (rama dev)
const totalErrors = ref(0);
const lastTypedLength = ref(0);
const lastWpmEmit = ref(0); // reservado por si luego quieres usarlo de nuevo

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

  // ---- error tracking (rama dev) ----
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

  // ---- race speed bump per correct char (HEAD logic) ----
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
    await nextText(); // carga nuevo texto
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
      // Only auto-detect if not already set
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
</script>

<style scoped>
.results-summary {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 0.75rem 0.85rem;
  width: 230px;
  max-height: 350px;
  overflow-y: auto;
  font-size: 0.85rem;
  z-index: 20;
  transition: all 0.3s ease;
}

.summary-title {
  font-weight: 600;
  font-size: 0.9rem;
  text-align: center;
  margin-bottom: 0.4rem;
  color: #374151;
}

.summary-item {
  background: white;
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  margin-bottom: 0.35rem;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  transition: background 0.3s, transform 0.2s;
}

.summary-item:last-child {
  margin-bottom: 0;
}

.summary-item.me {
  border-color: #2563eb;
  background: #eff6ff;
  transform: scale(1.02);
  box-shadow: 0 0 0 1px #2563eb;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.you-tag {
  font-size: 0.75rem;
  color: #2563eb;
}

.summary-stats {
  display: flex;
  justify-content: space-between;
  color: #374151;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #f3f4f6;
  padding: 0.3rem 0;
}
.summary-item:last-child {
  border-bottom: none;
}
.summary-item strong {
  color: #2563eb;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  animation: fadeIn 0.25s ease;
}
.modal {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  min-width: 260px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  animation: popIn 0.2s ease;
}
.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.75rem;
}
@keyframes fadeIn {
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

.bar.monster {
  background: #dc2626;
}
.bar.dead {
  background: #9ca3af;
}
.dead {
  opacity: 0.6;
  text-decoration: line-through;
}

/* Race bars */
.race-progress {
  margin-top: 1.5rem;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.bar-container {
  flex: 1;
  background: #e5e7eb;
  border-radius: 4px;
  height: 10px;
  overflow: hidden;
}

.bar {
  height: 100%;
  transition: width 0.1s linear;
  background: #2563eb;
}

/* Page layout */
.typing-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.25rem;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1rem;
}
.topbar h1 {
  margin: 0;
  font-size: 1.5rem;
}
.stats {
  display: flex;
  gap: 1rem;
  font-size: 0.95rem;
}

/* Text area */
.text-area {
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  min-height: 180px;
  line-height: 1.6;
  font-size: 1.05rem;
  background: #0f172a0d;
  cursor: text;
  user-select: none;
}

.text-wrapper {
  position: relative;
  color: #6b7280;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Status */
.status-message {
  text-align: center;
  padding: 2rem;
  font-size: 1.1rem;
}
.loading {
  color: #2563eb;
}
.error {
  color: #dc2626;
}

/* characters */
.char {
  position: relative;
}
.untouched {
  opacity: 0.65;
}
.correct {
  color: #10b981;
}
.wrong {
  color: #e81c1c;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.current {
  color: #111827;
}

/* blinking caret positioned dynamically */
.caret {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  background: #111827;
  position: absolute;
  z-index: 1;
  animation: blink 0.5s steps(2, start) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}

/* hidden input overlay */
.hidden-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  color: transparent;
  background: transparent;
  border: none;
  resize: none;
  cursor: text;
  caret-color: #111827;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  padding: 16px;
  outline: none;
}

/* Buttons */
.actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
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

/* results grids */
.results-section {
  margin: 2rem 0;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}
.participants-section {
  margin: 1.5rem 0;
  padding: 0.5rem 0;
}
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
.result-card {
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: white;
}
.result-card strong {
  color: #2563eb;
  display: block;
  margin-bottom: 0.5rem;
}

</style>