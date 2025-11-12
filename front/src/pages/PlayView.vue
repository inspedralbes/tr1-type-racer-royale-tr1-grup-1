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

    <!-- Race progress (server-authoritative) -->
    <section v-if="raceState.length" class="race-progress">
      <h3>Race progress</h3>

      <!-- Monster -->
      <div v-if="monsterState" class="progress-row">
        <span>🧟 Monster</span>
        <div class="bar-container">
          <div class="bar monster" :style="{ width: pct(monsterState.position) }"></div>
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

    <div class="corner-stack" v-if="finishedCards.length">
      <div
        v-for="c in finishedCards"
        :key="c.nickname"
        class="mini-card"
        :class="c.outcome"
      >
        <div class="row">
          <strong>{{ c.nickname }}</strong>
          <span v-if="c.outcome==='win'">🏁</span>
          <span v-else>💀</span>
        </div>
        <div class="sub" v-if="c.wpm">
          {{ c.wpm }} WPM · {{ c.accuracy }}%
        </div>
      </div>
    </div>
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
  </main>
</template>


<script setup>
const ROOM = "main-room"; // TODO: replace with dynamic room id when lobby wires it
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { getText } from "@/services/communicationManager.js";
import { socket, joinRoomOnce } from "@/services/socket.js";
import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";

const router = useRouter();
const user = useUserStore();
if (!user.hasNick) router.replace({ name: "home", query: { needNick: "1" } });

// DATA LOADING
const current = ref(null);
const target = ref("");
const loading = ref(true);
const error = ref(null);
const gameResults = ref([]);
const targetChars = computed(() => Array.from(target.value));
const finishedCards = ref([]); // {nickname, outcome: 'win'|'dead', wpm, accuracy}

// helper to add or update a card
function upsertCard(entry) {
  const i = finishedCards.value.findIndex(c => c.nickname === entry.nickname);
  if (i === -1) finishedCards.value.unshift(entry);
  else finishedCards.value[i] = { ...finishedCards.value[i], ...entry };
}

// RACE STATE (from server)
const raceState = ref([]);
const monsterState = ref(null);
const trackLen = ref(100);


socket.on("race:update", (snap) => {
  if (Array.isArray(snap)) {
    raceState.value    = snap;
    monsterState.value = null;
    trackLen.value = 100;
  } else {
    raceState.value    = snap.players || [];
    monsterState.value = snap.monster || null;
    trackLen.value = snap.trackLen || 100;
  }
});

function pct(pos) {
  const len = trackLen.value || 100;
  const clamped = Math.max(0, Math.min(pos, len));
  return ((clamped / len) * 100).toFixed(1) + "%";
}

function pushResultUnique(entry) {
  const i = gameResults.value.findIndex(r => r.nickname === entry.nickname);
  if (i === -1) gameResults.value.push(entry);
}

socket.on("player:finished", ({ nickname, wpm, accuracy }) => {
  pushResultUnique({ nickname, wpm, accuracy, state: "finished" });

  if (nickname === user.nickname) {
    endedAt.value = endedAt.value || Date.now();  // freeze
    showOverlay.value = true;                     // show modal
    // mark that we’ve reached the race end so typing is disabled
    reachedFinish.value = true;
  }
});

socket.on("player:caught", ({ nickname, wpm, accuracy }) => {
  pushResultUnique({ nickname, wpm, accuracy, state: "dead" });

  if (nickname === user.nickname) {
    dead.value = true;
    endedAt.value = endedAt.value || Date.now();  // freeze
    showOverlay.value = true;
    hiddenInput.value?.blur();
  }
});

socket.on("race:over", ({ winner }) => {
  console.log(`🏁 Race over! Winner: ${winner ?? "none"}`);

  if (winner === user.nickname) {
    // you reached TRACK_LEN distance
    endedAt.value = Date.now();
    showOverlay.value = true;
    dead.value = false;
  } else {
    // didn’t win (died or was slower)
    // if still alive, show mini summary but no overlay yet
    dead.value = dead.value; // preserve death state
  }
});

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
  () =>
    userInput.value.length >= target.value.length && target.value.length > 0
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
  dead.value = true; // mark as spectator
  hiddenInput.value?.blur();
}

const prevCorrect = ref(0);
const dead = ref(false);
const showOverlay = ref(false);
const reachedFinish = ref(false);

const typingDisabled = computed(() => dead.value || reachedFinish.value || finished.value || showOverlay.value);

// INPUT HANDLERS
async function onInput() {
  if (dead.value || finished.value) return;

  if (!startedAt.value && userInput.value.length > 0) {
    startedAt.value = Date.now();
  }

  if (userInput.value.length > target.value.length) {
    userInput.value = userInput.value.slice(0, target.value.length);
  }

  const was = prevCorrect.value;
  const now = correctChars.value;
  const correctChar = now > was;  // exactly what we want

  // Emit only the info server needs to adjust speed
  socket.emit("typing:progress", {
    room: ROOM,                 // your current room
    nickname: user.nickname,    // optional
    correctChar,                // <<—— IMPORTANT
    wpm: wpm.value,             // optional legacy UI
    accuracy: accuracy.value,   // optional legacy UI
  });

  prevCorrect.value = now;

  if (userInput.value.length >= target.value.length) {
  await nextText(); // fetches next text via getText()
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
  // single, idempotent join (no duplicate players)
  joinRoomOnce("main-room", user.nickname);

  socket.on("updateGameResults", (results) => {
    gameResults.value = results;
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
  socket.off("updateGameResults");
  socket.off("race:update");
  socket.off("connect");
  socket.off("player:caught");
  socket.off("race:over");
  // optional: socket.disconnect();
});

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
  animation: fadeIn 0.25s ease;
}
.modal {
  animation: popIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes popIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-actions { display:flex; gap:.5rem; justify-content:center; margin-top:.75rem; }

.bar.monster { background: #dc2626; }
.bar.dead    { background: #9ca3af; } /* gray for eliminated */
.dead        { opacity: 0.6; text-decoration: line-through; }

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
.loading { color: #2563eb; }
.error   { color: #dc2626; }

/* characters */
.char { position: relative; }
.untouched { opacity: 0.65; }
.correct { color: #10b981; }
.wrong {
  color: #e81c1c;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.current { color: #111827; }

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
@keyframes blink { 50% { opacity: 0; } }

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
.btn:hover { background: #f3f4f6; }

.results-section {
  margin: 2rem 0;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
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

.corner-stack {
  position: fixed; top: 12px; right: 12px; z-index: 60;
  display: flex; flex-direction: column; gap: 8px;
  max-width: 240px;
}
.mini-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 8px 10px;
  box-shadow: 0 6px 18px rgba(0,0,0,.08);
  font-size: 0.9rem;
}
.mini-card.win  { border-color: #10b981; }
.mini-card.dead { border-color: #ef4444; opacity: .9; }
.mini-card .row { display:flex; align-items:center; justify-content:space-between; gap:6px; }
.mini-card .sub { color:#6b7280; font-size:.8rem; margin-top:2px; }
</style>