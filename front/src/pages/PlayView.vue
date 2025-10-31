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
        <span v-for="(ch, i) in targetChars" :key="i" :class="charClass(i)">{{
          ch
        }}</span>
        <!-- blinking caret positioned dynamically -->
        <span v-if="!finished" class="caret" :style="caretStyle"></span>
      </div>

      <!-- hidden input to capture keyboard, mobile-friendly -->
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
    </section>

    <footer class="actions">
      <button class="btn" @click="reset">Reset</button>
      <button class="btn" @click="nextText">Next Text</button>
    </footer>
  </main>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from "vue";
//import { getText } from "@/communicationManager.js";
import { getText } from "@/services/communicationManager.js";

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
const targetChars = computed(() => Array.from(target.value));

async function pickRandomText() {
  try {
    // Obtenemos un ID aleatorio (suponiendo que hay 10 textos)
    const randomId = Math.floor(Math.random() * 10) + 1;

    // Llamamos al communication manager (usa HTTP)
    const data = await getText(randomId);

    const text = data.text ?? data.TEXT_CONTENT ?? data.TEXT;

    current.value = data;
    target.value = text ?? "";

  } catch (err) {
    console.error("Error cargando texto:", err);
    error.value = "Error al cargar el texto. ¿Está el servidor funcionando?";
  }
  finally{
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

// CARET POSITION (needs arreglation)
const caretStyle = computed(() => {
  const pos = userInput.value.length;

  if (!textWrapper.value) {
    return { position: "absolute", left: "0px", top: "0px" };
  }

  // Encontrar el span del carácter actual o el anterior
  const spans = textWrapper.value.querySelectorAll("span");

  if (pos === 0) {
    // Si no hay caracteres tipeados, posicionar al inicio
    return {
      position: "absolute",
      left: "0px",
      top: "0px",
    };
  }

  if (spans[pos - 1]) {
    // Posicionar después del último carácter tipeado
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

//CLASS LOGIC
function charClass(i) {
  const typed = userInput.value[i];
  if (i < userInput.value.length) {
    if (typed === target.value[i]) return "char correct";
    return "char wrong";
  }
  if (i === userInput.value.length) return "char current";
  return "char untouched";
}

//INPUT HANDLERS
function onInput() {
  if (!startedAt.value && userInput.value.length > 0) {
    startedAt.value = Date.now();
  }
  // Cap to target length (maxlength covers it, but just in case)
  if (userInput.value.length > target.value.length) {
    userInput.value = userInput.value.slice(0, target.value.length);
  }
  if (finished.value && !endedAt.value) {
    endedAt.value = Date.now();
  }
}

function onKeydown(e) {
  // prevent tabbing away
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
  focusInput();
}

async function nextText() {
  await pickRandomText();
  reset();
}

// MOUNT
onMounted(async () => {
  await pickRandomText();
  await nextTick();

  if(!target){
    const interval = setInterval(() => {
      if(target.value){
        clearInterval(interval);
        focusInput();
      }
    },100);

  }else{
    loading.value = false;
    focusInput();
  }

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
    await nextTick(); // Esperar a que el DOM se actualice
  }
);
</script>

<style scoped>
/* Layout */
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
  background: #0f172a0d; /* subtle slate */
  cursor: text;
  user-select: none; /* so clicks focus input */
}
.text-wrapper {
  position: relative; /* Para que el caret se posicione relativo a este contenedor */
  color: #6b7280; /* base (darkened) text */
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
}

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
} /* emerald */
.wrong {
  color: #e81c1c;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.current {
  color: #111827; /* brighten current slot slightly */
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
  caret-color: #111827; /* so the native caret still exists for accessibility */
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
</style>
